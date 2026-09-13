"use client";

import { useState, useCallback, useMemo } from "react";
import {
  useWriteContract,
  useReadContract,
  useAccount,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { Address, type WalletClient } from "viem";
import { encodeFunctionData } from "viem";
import { base } from "viem/chains";
import { ERC4626_ABI, ERC20_ABI } from "@/lib/config/yearn";

function ensureTxHash(value: unknown): `0x${string}` {
  if (typeof value === "string" && value.startsWith("0x") && value.length >= 64) {
    return value as `0x${string}`;
  }
  if (
    value &&
    typeof value === "object" &&
    "hash" in value &&
    typeof (value as { hash: unknown }).hash === "string"
  ) {
    const h = (value as { hash: string }).hash;
    return h as unknown as `0x${string}`;
  }
  throw new Error("Invalid transaction response: no hash returned. Please try again.");
}

/** Base mainnet – Yearn/Kalani vaults are on Base. */
const YEARN_VAULT_CHAIN_ID = 8453;

const BOUNCER_MESSAGE =
  "Deposit failed: This vault is for Creative Bank members only. Get a Creative Brand, Investor, or Creator NFT to deposit.";
const WRONG_NETWORK_MESSAGE = "Please switch your wallet to Base mainnet and try again.";

function extractRevertReason(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const e = error as Record<string, unknown>;
  if (typeof e.message === "string") return e.message;
  if (
    e.data &&
    typeof e.data === "object" &&
    typeof (e.data as Record<string, unknown>).message === "string"
  ) {
    return (e.data as Record<string, unknown>).message as string;
  }
  if (e.cause && typeof e.cause === "object") return extractRevertReason(e.cause);
  return "";
}

function normalizeDepositError(error: unknown): string {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Deposit failed";
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code: unknown }).code
      : undefined;
  const codeStr = typeof code === "number" ? String(code) : typeof code === "string" ? code : "";
  const lower = msg.toLowerCase();

  // User rejection
  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    codeStr === "4001" ||
    codeStr === "ACTION_REJECTED"
  ) {
    return "Transaction was cancelled";
  }

  // Wrong network / chain
  if (
    lower.includes("chain mismatch") ||
    lower.includes("unsupported chain") ||
    lower.includes("wrong network") ||
    lower.includes("switch your wallet") ||
    lower.includes("switch to base")
  ) {
    return WRONG_NETWORK_MESSAGE;
  }

  // RPC / network (generic)
  if (
    codeStr === "NETWORK_ERROR" ||
    codeStr === "ECONNRESET" ||
    codeStr === "ETIMEDOUT" ||
    lower.includes("network") ||
    lower.includes("rpc") ||
    lower.includes("fetch failed")
  ) {
    return "Network error. Please check your connection and try again.";
  }

  // Bouncer / deposit limit (Creative Bank members only)
  if (
    lower.includes("deposit limit") ||
    lower.includes("availabledepositlimit") ||
    lower.includes("members only") ||
    lower.includes("bouncer") ||
    (lower.includes("not allowed") && lower.includes("deposit"))
  ) {
    return BOUNCER_MESSAGE;
  }

  // Already a clear message from our code
  if (
    msg.startsWith("Deposit failed:") ||
    msg.startsWith("Transaction") ||
    msg.startsWith("Insufficient")
  ) {
    return msg;
  }

  // Generic revert: prefer decoded reason when available
  if (msg.includes("revert") || msg.includes("execution reverted")) {
    const reason = extractRevertReason(error);
    if (reason && reason.length > 0 && reason.length < 200) {
      return `Deposit failed: ${reason}`;
    }
    return "Deposit failed: The transaction was reverted. The vault may be paused, at capacity, or you may not be eligible. Please try again or check the vault status.";
  }

  return msg.length > 120 ? `Deposit failed: ${msg.slice(0, 120)}…` : msg;
}

type DepositState = {
  status: "idle" | "approving" | "depositing" | "success" | "error";
  txHash?: string;
  error?: string;
};

type UseYearnDepositReturn = {
  deposit: (assets: bigint, receiver: Address) => Promise<void>;
  state: DepositState;
  reset: () => void;
};

/**
 * Hook to handle Yearn V3 vault deposits with ERC-4626 compliance
 * Follows the standard flow: approve token -> deposit assets
 * Supports both Crossmint wallet and wagmi wallet
 */
export const useYearnDeposit = (
  vaultAddress: Address | undefined,
  assetAddress: Address | undefined,
  walletClient?: WalletClient
): UseYearnDepositReturn => {
  const [state, setState] = useState<DepositState>({ status: "idle" });
  const { address: wagmiAddress } = useAccount();
  const { wallet: crossmintWallet } = useWallet();
  // Use explicit Base chain so reads/estimates work when Crossmint is connected (no wagmi active chain)
  const publicClient = usePublicClient({ chainId: YEARN_VAULT_CHAIN_ID });
  const { data: wagmiWalletClient } = useWalletClient();

  // Determine active address (Crossmint takes priority, fallback to wagmi)
  // This must match the logic in YearnVaultModal to ensure we use the correct address
  const ownerAddress = useMemo(() => {
    if (crossmintWallet?.address) {
      return crossmintWallet.address as `0x${string}`;
    }
    return wagmiAddress;
  }, [crossmintWallet?.address, wagmiAddress]);

  // Use provided wallet client, fallback to wagmi wallet client
  const activeWalletClient = walletClient || wagmiWalletClient;

  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeDeposit } = useWriteContract();

  // Check current allowance - allowance(owner, spender) on Base
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: assetAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: vaultAddress && assetAddress && ownerAddress ? [ownerAddress, vaultAddress] : undefined,
    chainId: YEARN_VAULT_CHAIN_ID,
    query: {
      enabled: !!vaultAddress && !!assetAddress && !!ownerAddress,
    },
  });

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const deposit = useCallback(
    async (assets: bigint, receiver: Address) => {
      if (!vaultAddress || !assetAddress) {
        setState({
          status: "error",
          error: "Vault or asset address not provided",
        });
        return;
      }

      if (!ownerAddress) {
        setState({
          status: "error",
          error: "Wallet not connected",
        });
        return;
      }

      try {
        // Pre-deposit validation: Check maxDeposit before attempting
        if (publicClient && vaultAddress && receiver) {
          try {
            const maxDeposit = await publicClient.readContract({
              address: vaultAddress,
              abi: ERC4626_ABI,
              functionName: "maxDeposit",
              args: [receiver],
            });

            if (maxDeposit < assets) {
              const maxDepositFormatted =
                maxDeposit === 0n
                  ? "0 (vault may be paused or at capacity)"
                  : `${Number(maxDeposit) / 1e6} USDC`;
              throw new Error(
                `Deposit amount exceeds maximum allowed. Maximum deposit: ${maxDepositFormatted}. Your requested amount: ${Number(assets) / 1e6} USDC.`
              );
            }
          } catch (maxDepositError: any) {
            // If maxDeposit check fails, log it but continue (might be a read error)
            console.warn("Could not check maxDeposit:", maxDepositError);
            // Don't throw here - let the gas estimation catch the actual error
          }
        }

        // Step 1: Check and handle approval if needed
        const { data: newAllowance } = await refetchAllowance();
        const allowance = (newAllowance as bigint) ?? 0n;

        if (allowance < assets) {
          setState({ status: "approving" });

          let approveHash: `0x${string}`;

          // Use custom wallet client if provided (Crossmint), otherwise use wagmi
          if (activeWalletClient) {
            // Encode the function data
            const data = encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [vaultAddress, assets],
            });

            // Get account from wallet client
            const accounts = await activeWalletClient.getAddresses();
            const account = accounts[0];

            if (!account) {
              throw new Error("No account available in wallet");
            }

            // Yearn vaults are on Base mainnet only; always send on Base
            const approveResult = await activeWalletClient.sendTransaction({
              account,
              to: assetAddress,
              data,
              chain: base,
            });
            approveHash = ensureTxHash(approveResult);
          } else {
            const hash = await writeApprove({
              address: assetAddress,
              abi: ERC20_ABI,
              functionName: "approve",
              args: [vaultAddress, assets],
              chainId: 8453,
            });
            if (!hash) {
              throw new Error("Approval transaction failed");
            }
            approveHash = hash;
          }

          // Wait for approval to be mined
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({
              hash: approveHash,
              timeout: 120_000, // 2 minute timeout
            });
          }

          // Refetch allowance after approval
          await refetchAllowance();
        }

        // Step 2: Execute deposit
        setState({ status: "depositing" });

        let depositHash: `0x${string}`;

        // Use custom wallet client if provided (Crossmint), otherwise use wagmi
        if (activeWalletClient) {
          // Encode the function data
          const data = encodeFunctionData({
            abi: ERC4626_ABI,
            functionName: "deposit",
            args: [assets, receiver],
          });

          // Get account from wallet client
          const accounts = await activeWalletClient.getAddresses();
          const account = accounts[0];

          if (!account) {
            throw new Error("No account available in wallet");
          }

          // Estimate gas before sending (helps catch errors early)
          let gasEstimate: bigint | undefined;
          try {
            if (publicClient) {
              gasEstimate = await publicClient.estimateGas({
                account,
                to: vaultAddress,
                data,
              });
            }
          } catch (gasError: any) {
            // If gas estimation fails, the transaction will likely fail
            console.error("Gas estimation error:", gasError);

            // Try to extract the actual revert reason from viem error
            let errorMessage = gasError?.message || "Transaction would fail";
            let revertReason = "";

            // Check for revert reason in error data
            if (gasError?.data) {
              if (typeof gasError.data === "string") {
                revertReason = gasError.data;
              } else if (gasError.data?.message) {
                revertReason = gasError.data.message;
              } else if (gasError.data?.reason) {
                revertReason = gasError.data.reason;
              }
            }

            // Check for revert reason in cause
            if (!revertReason && gasError?.cause) {
              if (typeof gasError.cause === "string") {
                revertReason = gasError.cause;
              } else if (gasError.cause?.message) {
                revertReason = gasError.cause.message;
              } else if (gasError.cause?.data?.message) {
                revertReason = gasError.cause.data.message;
              }
            }

            // Try to parse common revert reasons
            if (
              revertReason ||
              errorMessage.includes("revert") ||
              errorMessage.includes("execution reverted")
            ) {
              // Check for specific revert reasons
              const lowerReason = (revertReason + " " + errorMessage).toLowerCase();

              if (lowerReason.includes("paused") || lowerReason.includes("pause")) {
                throw new Error(
                  "Deposit failed: The vault is currently paused. Deposits are not available at this time."
                );
              }

              if (
                lowerReason.includes("deposit limit") ||
                lowerReason.includes("availabledepositlimit") ||
                lowerReason.includes("members only") ||
                lowerReason.includes("bouncer")
              ) {
                throw new Error(BOUNCER_MESSAGE);
              }

              if (
                lowerReason.includes("capacity") ||
                lowerReason.includes("limit") ||
                lowerReason.includes("max")
              ) {
                throw new Error(
                  "Deposit failed: The vault has reached its deposit capacity. Please try a smaller amount or try again later."
                );
              }

              if (lowerReason.includes("allowance") || lowerReason.includes("approval")) {
                throw new Error(
                  "Deposit failed: Insufficient token allowance. Please approve the vault to spend your tokens."
                );
              }

              // Prefer decoded revert reason when available
              const detailedError = revertReason
                ? `Deposit failed: ${revertReason}`
                : "Deposit failed: The transaction was reverted. The vault may be paused, have insufficient capacity, or there may be another issue. Please check the vault status and try again.";

              throw new Error(detailedError);
            }

            throw new Error(`Transaction validation failed: ${errorMessage}`);
          }

          // Yearn vaults are on Base mainnet only; always send on Base
          try {
            const depositResult = await activeWalletClient.sendTransaction({
              account,
              to: vaultAddress,
              data,
              chain: base,
              gas: gasEstimate ? (gasEstimate * 120n) / 100n : undefined, // Add 20% buffer
            });
            depositHash = ensureTxHash(depositResult);
          } catch (txError: unknown) {
            const errorMessage =
              txError && typeof txError === "object" && "message" in txError
                ? String((txError as { message: unknown }).message)
                : "Transaction failed";
            const revertReason = extractRevertReason(txError);
            const combined = (revertReason + " " + errorMessage).toLowerCase();

            if (combined.includes("user rejected") || combined.includes("user denied")) {
              throw new Error("Transaction was cancelled");
            }
            if (
              combined.includes("deposit limit") ||
              combined.includes("availabledepositlimit") ||
              combined.includes("members only") ||
              combined.includes("bouncer")
            ) {
              throw new Error(BOUNCER_MESSAGE);
            }
            const displayReason = revertReason || errorMessage;
            throw new Error(
              displayReason.startsWith("Deposit failed:")
                ? displayReason
                : `Deposit failed: ${displayReason}`
            );
          }
        } else {
          try {
            const hash = await writeDeposit({
              address: vaultAddress,
              abi: ERC4626_ABI,
              functionName: "deposit",
              args: [assets, receiver],
              chainId: 8453,
            });
            if (!hash) {
              throw new Error("Deposit transaction failed");
            }
            depositHash = hash;
          } catch (txError: unknown) {
            const errorMessage =
              txError && typeof txError === "object" && "message" in txError
                ? String((txError as { message: unknown }).message)
                : "Transaction failed";
            const revertReason = extractRevertReason(txError);
            const combined = (revertReason + " " + errorMessage).toLowerCase();

            if (combined.includes("user rejected") || combined.includes("user denied")) {
              throw new Error("Transaction was cancelled");
            }
            if (
              combined.includes("deposit limit") ||
              combined.includes("availabledepositlimit") ||
              combined.includes("members only") ||
              combined.includes("bouncer")
            ) {
              throw new Error(BOUNCER_MESSAGE);
            }
            const displayReason = revertReason || errorMessage;
            throw new Error(
              displayReason.startsWith("Deposit failed:")
                ? displayReason
                : `Deposit failed: ${displayReason}`
            );
          }
        }

        // Wait for deposit to be mined
        if (publicClient) {
          try {
            const receipt = await publicClient.waitForTransactionReceipt({
              hash: depositHash,
              timeout: 120_000, // 2 minute timeout
            });

            // Check if transaction was reverted
            if (receipt.status === "reverted") {
              throw new Error(
                "Transaction was reverted on-chain. Please check the transaction on Basescan for more details."
              );
            }
          } catch (waitError: any) {
            // If waiting fails, the transaction might still be pending or reverted
            const errorMessage = waitError?.message || "Failed to confirm transaction";
            if (errorMessage.includes("timeout")) {
              throw new Error(
                "Transaction is taking longer than expected. Please check the transaction status on Basescan."
              );
            }
            throw new Error(`Failed to confirm transaction: ${errorMessage}`);
          }
        }

        setState({
          status: "success",
          txHash: depositHash,
        });
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Deposit error (technical details):", error);
        } else {
          console.error("Deposit error:", error);
        }
        setState({
          status: "error",
          error: normalizeDepositError(error),
        });
      }
    },
    [
      vaultAddress,
      assetAddress,
      ownerAddress,
      currentAllowance,
      activeWalletClient,
      writeApprove,
      writeDeposit,
      refetchAllowance,
      publicClient,
    ]
  );

  return {
    deposit,
    state,
    reset,
  };
};
