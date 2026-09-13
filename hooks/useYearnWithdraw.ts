"use client";

import { useState, useCallback } from "react";
import { usePublicClient, useWriteContract, useWalletClient } from "wagmi";
import { Address, type WalletClient, encodeFunctionData } from "viem";
import { ERC4626_ABI, MAX_LOSS_BPS, YEARN_CHAIN_ID } from "@/lib/config/yearn";

type WithdrawState = {
  status: "idle" | "redeeming" | "success" | "error";
  txHash?: string;
  error?: string;
};

type UseYearnWithdrawReturn = {
  redeem: (shares: bigint, receiver: Address, owner: Address, maxLossBps?: number) => Promise<void>;
  state: WithdrawState;
  reset: () => void;
};

/**
 * Hook to handle Yearn V3 vault withdrawals using the redeem function
 * Recommended over withdraw function per Yearn V3 best practices
 * Supports both Crossmint wallet and wagmi wallet
 *
 * @param vaultAddress - Address of the Yearn V3 vault
 * @param walletClient - Optional wallet client (for Crossmint support)
 */
export const useYearnWithdraw = (
  vaultAddress: Address | undefined,
  walletClient?: WalletClient
): UseYearnWithdrawReturn => {
  const [state, setState] = useState<WithdrawState>({ status: "idle" });

  const publicClient = usePublicClient({ chainId: YEARN_CHAIN_ID });
  const { data: wagmiWalletClient } = useWalletClient();
  const { writeContractAsync: writeRedeem } = useWriteContract();

  // Use provided wallet client, fallback to wagmi wallet client
  const activeWalletClient = walletClient || wagmiWalletClient;

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const redeem = useCallback(
    async (
      shares: bigint,
      receiver: Address,
      owner: Address,
      maxLossBps: number = MAX_LOSS_BPS.UNLIMITED
    ) => {
      if (!vaultAddress) {
        setState({
          status: "error",
          error: "Vault address not provided",
        });
        return;
      }

      try {
        setState({ status: "redeeming" });

        // Try with maxLoss first (for Yearn V3 vaults)
        // If that fails, fall back to standard ERC-4626 redeem (for Aave vaults)
        let redeemHash: `0x${string}`;

        try {
          // Use custom wallet client if provided (Crossmint), otherwise use wagmi
          if (activeWalletClient) {
            // Get account from wallet client
            const accounts = await activeWalletClient.getAddresses();
            const account = accounts[0];

            if (!account) {
              throw new Error("No account available in wallet");
            }

            // Attempt with maxLoss parameter (Yearn V3 style)
            try {
              const data = encodeFunctionData({
                abi: ERC4626_ABI,
                functionName: "redeem",
                args: [shares, receiver, owner, BigInt(maxLossBps)],
              });

              redeemHash = await activeWalletClient.sendTransaction({
                account,
                to: vaultAddress,
                data,
                chain: activeWalletClient.chain || null,
              });
            } catch (maxLossError) {
              // If maxLoss fails, try standard ERC-4626 redeem (Aave vaults)
              console.log("maxLoss parameter not supported, trying standard redeem...");
              const data = encodeFunctionData({
                abi: [
                  {
                    inputs: [
                      { name: "shares", type: "uint256" },
                      { name: "receiver", type: "address" },
                      { name: "owner", type: "address" },
                    ],
                    name: "redeem",
                    outputs: [{ name: "assets", type: "uint256" }],
                    stateMutability: "nonpayable",
                    type: "function",
                  },
                ],
                functionName: "redeem",
                args: [shares, receiver, owner],
              });

              redeemHash = await activeWalletClient.sendTransaction({
                account,
                to: vaultAddress,
                data,
                chain: activeWalletClient.chain || null,
              });
            }
          } else {
            // Use wagmi writeContract
            try {
              redeemHash = await writeRedeem({
                address: vaultAddress,
                abi: ERC4626_ABI,
                functionName: "redeem",
                args: [shares, receiver, owner, BigInt(maxLossBps)],
                chainId: 8453,
              });
            } catch (maxLossError) {
              // If maxLoss fails, try standard ERC-4626 redeem (Aave vaults)
              console.log("maxLoss parameter not supported, trying standard redeem...");
              redeemHash = await writeRedeem({
                address: vaultAddress,
                abi: [
                  {
                    inputs: [
                      { name: "shares", type: "uint256" },
                      { name: "receiver", type: "address" },
                      { name: "owner", type: "address" },
                    ],
                    name: "redeem",
                    outputs: [{ name: "assets", type: "uint256" }],
                    stateMutability: "nonpayable",
                    type: "function",
                  },
                ],
                functionName: "redeem",
                args: [shares, receiver, owner],
                chainId: 8453,
              });
            }
          }
        } catch (error) {
          throw error;
        }

        if (!redeemHash) {
          throw new Error("Redeem transaction failed");
        }

        if (!publicClient) {
          throw new Error("Public client unavailable while confirming withdrawal");
        }

        // Wait for confirmation so the modal can close after a real success.
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: redeemHash,
          timeout: 120_000,
        });
        if (receipt.status === "reverted") {
          throw new Error("Withdrawal transaction reverted");
        }

        setState({ status: "success", txHash: redeemHash });
      } catch (error) {
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Withdrawal failed",
        });
      }
    },
    [vaultAddress, activeWalletClient, writeRedeem]
  );

  return {
    redeem,
    state,
    reset,
  };
};

/**
 * Hook to handle Yearn V3 vault withdrawals using the withdraw function
 * Note: redeem is recommended over withdraw, but this is provided for completeness
 *
 * @param vaultAddress - Address of the Yearn V3 vault
 * @param maxLossBps - Maximum loss in basis points (default: 0 = 0%)
 */
export const useYearnWithdrawAssets = (
  vaultAddress: Address | undefined
): UseYearnWithdrawReturn => {
  const [state, setState] = useState<WithdrawState>({ status: "idle" });

  const publicClient = usePublicClient({ chainId: YEARN_CHAIN_ID });
  const { writeContractAsync: writeWithdraw } = useWriteContract();

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const redeem = useCallback(
    async (
      assets: bigint,
      receiver: Address,
      owner: Address,
      maxLossBps: number = MAX_LOSS_BPS.NONE
    ) => {
      if (!vaultAddress) {
        setState({
          status: "error",
          error: "Vault address not provided",
        });
        return;
      }

      try {
        setState({ status: "redeeming" });

        const withdrawHash = await writeWithdraw({
          address: vaultAddress,
          abi: ERC4626_ABI,
          functionName: "withdraw",
          args: [assets, receiver, owner, BigInt(maxLossBps)],
          chainId: 8453,
        });

        if (!withdrawHash) {
          throw new Error("Withdraw transaction failed");
        }

        if (!publicClient) {
          throw new Error("Public client unavailable while confirming withdraw");
        }

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: withdrawHash,
          timeout: 120_000,
        });
        if (receipt.status === "reverted") {
          throw new Error("Withdraw transaction reverted");
        }

        setState({ status: "success", txHash: withdrawHash });
      } catch (error) {
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Withdrawal failed",
        });
      }
    },
    [vaultAddress, writeWithdraw]
  );

  return {
    redeem,
    state,
    reset,
  };
};
