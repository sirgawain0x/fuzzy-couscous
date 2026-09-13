"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Address, encodeFunctionData, formatUnits, parseUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@crossmint/client-sdk-react-ui";

import { Modal } from "@/components/common/Modal";
import { useAaveWalletClient } from "@/hooks/useAaveWalletClient";
import { formatUsd } from "@/lib/formatters";
import { formatVaultShares } from "@/lib/yearnUtils";
import {
  normalizeTxErrorMessage,
  showTxErrorToast,
  showTxSuccessToast,
} from "@/lib/transactionToast";

type WithdrawInputMode = "shares" | "asset";

const TX_CONFIRMATION_TIMEOUT_MS = 120_000;

const ERC20_ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const ERC4626_DEPOSIT_ABI = [
  {
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    name: "deposit",
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const ERC4626_REDEEM_ABI = [
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
] as const;

const ERC4626_WITHDRAW_ABI = [
  {
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    name: "withdraw",
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const ERC4626_CONVERT_ABI = [
  {
    inputs: [{ name: "shares", type: "uint256" }],
    name: "convertToAssets",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "assets", type: "uint256" }],
    name: "convertToShares",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

type AaveVaultModalProps = {
  open: boolean;
  onClose: () => void;
  vaultAddress: Address;
  assetAddress?: Address;
  assetSymbol?: string;
  assetDecimals?: number;
  shareDecimals?: number;
  mode: "deposit" | "withdraw";
  userAddress: Address | undefined;
  userAssetBalance?: bigint;
  shareBalance?: bigint;
  isBalanceLoading?: boolean;
  onSuccess?: () => void;
};

export function AaveVaultModal({
  open,
  onClose,
  vaultAddress,
  assetAddress,
  assetSymbol = "USDC",
  assetDecimals = 6,
  shareDecimals,
  mode,
  userAddress,
  userAssetBalance = 0n,
  shareBalance = 0n,
  isBalanceLoading = false,
  onSuccess,
}: AaveVaultModalProps) {
  const { address: wagmiAddress } = useAccount();
  const walletClient = useAaveWalletClient();
  const publicClient = usePublicClient();
  const { status: authStatus } = useAuth();
  const { status: walletStatus } = useWallet();

  // Both deposit/withdrawal previews and transactions use direct on-chain
  // ERC-4626 / ERC-20 contract calls instead of the Aave SDK, which throws
  // unrecoverable InvariantError on GraphQL "Service panicked" errors.

  const [inputAmount, setInputAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expectedShares, setExpectedShares] = useState<string | null>(null);
  const [expectedAssets, setExpectedAssets] = useState<string | null>(null);
  const [expectedSharesToBurn, setExpectedSharesToBurn] = useState<string | null>(null);
  const [expectedSharesToBurnDecimals, setExpectedSharesToBurnDecimals] = useState<number>(18);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [withdrawInputMode, setWithdrawInputMode] = useState<WithdrawInputMode>("shares");
  const [shareBalanceInUsdc, setShareBalanceInUsdc] = useState<string | null>(null);
  const [isShareBalanceUsdcLoading, setIsShareBalanceUsdcLoading] = useState(false);

  const isWithdrawAssetMode = mode === "withdraw" && withdrawInputMode === "asset";

  const resolvedShareDecimals = shareDecimals;
  const isShareDecimalsLoading = mode === "withdraw" && resolvedShareDecimals == null;

  const inputDecimals = useMemo(() => {
    if (mode === "deposit") return assetDecimals;
    if (mode === "withdraw") {
      return withdrawInputMode === "shares" ? (resolvedShareDecimals ?? 18) : assetDecimals;
    }
    return assetDecimals;
  }, [mode, withdrawInputMode, assetDecimals, resolvedShareDecimals]);

  const normalizeAmountForBigDecimal = useCallback(
    (raw: string, decimals: number): string | null => {
      const cleaned = raw.trim();
      if (!cleaned || cleaned === ".") return null;

      let noExp = cleaned;
      if (noExp.toLowerCase().includes("e")) {
        const num = Number(noExp);
        if (!Number.isFinite(num) || num < 0) return null;
        noExp = num.toFixed(decimals);
      }

      if (noExp.startsWith(".")) noExp = `0${noExp}`;

      try {
        const units = parseUnits(noExp, decimals);
        return formatUnits(units, decimals);
      } catch {
        return null;
      }
    },
    []
  );

  const normalizedInputAmount = useMemo(() => {
    return normalizeAmountForBigDecimal(inputAmount, inputDecimals);
  }, [inputAmount, inputDecimals, normalizeAmountForBigDecimal]);

  const inputUnits = useMemo(() => {
    if (normalizedInputAmount == null) return null;
    try {
      return parseUnits(normalizedInputAmount, inputDecimals);
    } catch {
      return null;
    }
  }, [normalizedInputAmount, inputDecimals]);

  const hasPositiveInput = inputUnits != null && inputUnits > 0n;

  useEffect(() => {
    let active = true;
    if (mode === "deposit" && hasPositiveInput && inputUnits != null && publicClient) {
      setExpectedShares(null);
      publicClient
        .readContract({
          address: vaultAddress,
          abi: ERC4626_CONVERT_ABI,
          functionName: "convertToShares",
          args: [inputUnits],
        })
        .then((shares) => {
          if (active)
            setExpectedShares(formatUnits(shares, resolvedShareDecimals ?? assetDecimals));
        })
        .catch(() => {
          if (active) setExpectedShares(null);
        });
    } else {
      setExpectedShares(null);
    }
    return () => {
      active = false;
    };
  }, [
    mode,
    hasPositiveInput,
    inputUnits,
    vaultAddress,
    publicClient,
    resolvedShareDecimals,
    assetDecimals,
  ]);

  useEffect(() => {
    if (!publicClient || !hasPositiveInput || inputUnits == null) {
      setExpectedAssets(null);
      setExpectedSharesToBurn(null);
      return;
    }
    if (mode === "withdraw" && withdrawInputMode === "shares") {
      if (resolvedShareDecimals == null) {
        setExpectedAssets(null);
        return;
      }
      setExpectedSharesToBurn(null);
      publicClient
        .readContract({
          address: vaultAddress,
          abi: ERC4626_CONVERT_ABI,
          functionName: "convertToAssets",
          args: [inputUnits],
        })
        .then((assets) => setExpectedAssets(formatUnits(assets, assetDecimals)))
        .catch(() => {
          setExpectedAssets(null);
          setErrorMessage(
            "Unable to preview withdrawal — please check your connection and try again."
          );
        });
    } else if (mode === "withdraw" && withdrawInputMode === "asset") {
      if (resolvedShareDecimals == null) {
        setExpectedSharesToBurn(null);
        return;
      }
      setExpectedAssets(null);
      publicClient
        .readContract({
          address: vaultAddress,
          abi: ERC4626_CONVERT_ABI,
          functionName: "convertToShares",
          args: [inputUnits],
        })
        .then((shares) => {
          setExpectedSharesToBurn(formatUnits(shares, resolvedShareDecimals));
          setExpectedSharesToBurnDecimals(resolvedShareDecimals);
        })
        .catch(() => {
          setExpectedSharesToBurn(null);
          setErrorMessage(
            "Unable to preview withdrawal — please check your connection and try again."
          );
        });
    } else {
      setExpectedAssets(null);
      setExpectedSharesToBurn(null);
    }
  }, [
    mode,
    withdrawInputMode,
    hasPositiveInput,
    inputUnits,
    vaultAddress,
    publicClient,
    assetDecimals,
    resolvedShareDecimals,
  ]);

  useEffect(() => {
    if (mode !== "withdraw" || !shareBalance || shareBalance === 0n) {
      setShareBalanceInUsdc(null);
      return;
    }
    if (resolvedShareDecimals == null) {
      setShareBalanceInUsdc(null);
      return;
    }
    if (!publicClient) {
      setShareBalanceInUsdc(null);
      return;
    }
    setIsShareBalanceUsdcLoading(true);
    publicClient
      .readContract({
        address: vaultAddress,
        abi: ERC4626_CONVERT_ABI,
        functionName: "convertToAssets",
        args: [shareBalance],
      })
      .then((assets) => {
        setShareBalanceInUsdc(
          normalizeAmountForBigDecimal(formatUnits(assets, assetDecimals), assetDecimals)
        );
      })
      .catch(() => setShareBalanceInUsdc(null))
      .finally(() => setIsShareBalanceUsdcLoading(false));
  }, [
    mode,
    shareBalance,
    vaultAddress,
    assetDecimals,
    normalizeAmountForBigDecimal,
    resolvedShareDecimals,
    publicClient,
  ]);

  const shareBalanceInUsdcUnits = useMemo(() => {
    if (shareBalanceInUsdc == null) return null;
    try {
      return parseUnits(shareBalanceInUsdc, assetDecimals);
    } catch {
      return null;
    }
  }, [shareBalanceInUsdc, assetDecimals]);

  const expectedSharesToBurnNormalized = useMemo(() => {
    if (expectedSharesToBurn == null) return null;
    return normalizeAmountForBigDecimal(expectedSharesToBurn, expectedSharesToBurnDecimals);
  }, [expectedSharesToBurn, expectedSharesToBurnDecimals, normalizeAmountForBigDecimal]);

  const expectedSharesToBurnUnits = useMemo(() => {
    if (expectedSharesToBurnNormalized == null) return null;
    try {
      return parseUnits(expectedSharesToBurnNormalized, expectedSharesToBurnDecimals);
    } catch {
      return null;
    }
  }, [expectedSharesToBurnNormalized, expectedSharesToBurnDecimals]);

  const sendAndWait = useCallback(
    async (tx: { to: string; data: string; value?: string }) => {
      if (!walletClient || !publicClient || !userAddress)
        throw new Error("Wallet or RPC not available");
      const valueBigInt = tx.value ? BigInt(tx.value) : 0n;
      const hash = await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: (tx.data || "0x") as `0x${string}`,
        value: valueBigInt,
        account: { address: userAddress, type: "json-rpc" },
        chain: publicClient.chain as never as import("viem").Chain,
      });
      await publicClient.waitForTransactionReceipt({
        hash,
        timeout: TX_CONFIRMATION_TIMEOUT_MS,
      });
      return hash;
    },
    [walletClient, publicClient, userAddress]
  );

  const resetForm = useCallback(() => {
    setInputAmount("");
    setErrorMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const validate = useCallback((): string | null => {
    if (!userAddress) {
      if (authStatus === "initializing" || walletStatus === "in-progress")
        return "Wallet is connecting...";
      return "Connect a wallet to continue.";
    }
    if (mode === "withdraw" && isShareDecimalsLoading) return "Loading share decimals...";
    if (!hasPositiveInput || inputUnits == null) return "Please enter a valid amount.";
    if (mode === "deposit") {
      if (isBalanceLoading) return "Balance is loading...";
      if (userAssetBalance < inputUnits) return `Insufficient ${assetSymbol} balance.`;
    } else {
      if (withdrawInputMode === "shares") {
        if (shareBalance < inputUnits) return "Insufficient vault shares.";
      } else {
        if (isShareBalanceUsdcLoading) return "Balance is loading...";
        if (shareBalanceInUsdcUnits == null) return "Balance is loading...";
        if (shareBalanceInUsdcUnits === 0n) {
          return `Insufficient balance. Maximum withdrawable: ${shareBalanceInUsdc ?? "0"} ${assetSymbol}.`;
        }
        if (inputUnits > shareBalanceInUsdcUnits) {
          return `Insufficient balance. Maximum withdrawable: ${shareBalanceInUsdc ?? "0"} ${assetSymbol}.`;
        }
      }
    }
    return null;
  }, [
    userAddress,
    hasPositiveInput,
    inputUnits,
    mode,
    withdrawInputMode,
    isShareDecimalsLoading,
    isBalanceLoading,
    isShareBalanceUsdcLoading,
    shareBalanceInUsdcUnits,
    shareBalanceInUsdc,
    userAssetBalance,
    shareBalance,
    assetDecimals,
    assetSymbol,
    authStatus,
    walletStatus,
  ]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErrorMessage(null);

      const err = validate();
      if (err) {
        setErrorMessage(err);
        return;
      }

      if (
        !walletClient ||
        !publicClient ||
        !userAddress ||
        normalizedInputAmount == null ||
        inputUnits == null
      ) {
        setErrorMessage("Wallet or amount not ready.");
        return;
      }

      setIsSubmitting(true);
      try {
        if (mode === "deposit") {
          if (!assetAddress) {
            setErrorMessage("Asset address is not configured for this vault.");
            return;
          }

          // Check ERC-20 allowance and approve if needed
          const allowance = await publicClient.readContract({
            address: assetAddress,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [userAddress, vaultAddress],
          });

          if (allowance < inputUnits) {
            const approveData = encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [vaultAddress, inputUnits],
            });
            await sendAndWait({ to: assetAddress, data: approveData });
          }

          const depositData = encodeFunctionData({
            abi: ERC4626_DEPOSIT_ABI,
            functionName: "deposit",
            args: [inputUnits, userAddress],
          });
          const txHash = await sendAndWait({ to: vaultAddress, data: depositData });

          showTxSuccessToast({
            title: "Deposit complete",
            description: `${formatUsd(normalizedInputAmount)} ${assetSymbol} deposited successfully.`,
            txHash,
          });
        } else {
          // Withdraw directly via the vault's ERC-4626 contract.
          // The Aave API is not needed for withdrawals and is unreliable
          // (returns "Service panicked" errors), so we call the vault directly.
          let txHash: string | undefined;
          if (withdrawInputMode === "shares") {
            const data = encodeFunctionData({
              abi: ERC4626_REDEEM_ABI,
              functionName: "redeem",
              args: [inputUnits, userAddress, userAddress],
            });
            txHash = await sendAndWait({ to: vaultAddress, data });
          } else {
            const data = encodeFunctionData({
              abi: ERC4626_WITHDRAW_ABI,
              functionName: "withdraw",
              args: [inputUnits, userAddress, userAddress],
            });
            txHash = await sendAndWait({ to: vaultAddress, data });
          }

          showTxSuccessToast({
            title: "Withdraw complete",
            description: `${formatUsd(normalizedInputAmount)} ${assetSymbol} withdrawn successfully.`,
            txHash,
          });
        }

        resetForm();
        onSuccess?.();
        handleClose();
      } catch (err) {
        const message = normalizeTxErrorMessage(
          err,
          mode === "deposit" ? "Deposit failed" : "Withdraw failed"
        );
        setErrorMessage(message);
        showTxErrorToast({
          title: mode === "deposit" ? "Deposit failed" : "Withdraw failed",
          description: message,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      validate,
      mode,
      withdrawInputMode,
      walletClient,
      publicClient,
      userAddress,
      normalizedInputAmount,
      inputUnits,
      vaultAddress,
      assetAddress,
      sendAndWait,
      assetSymbol,
      onSuccess,
      handleClose,
      resetForm,
    ]
  );

  const handleMaxClick = useCallback(() => {
    if (mode === "deposit" && userAssetBalance !== undefined) {
      setInputAmount(formatUnits(userAssetBalance, assetDecimals));
    } else if (mode === "withdraw") {
      if (withdrawInputMode === "shares" && shareBalance !== undefined) {
        setInputAmount(formatUnits(shareBalance, resolvedShareDecimals ?? 18));
      } else if (withdrawInputMode === "asset" && shareBalanceInUsdc != null) {
        setInputAmount(shareBalanceInUsdc);
      }
    }
  }, [
    mode,
    withdrawInputMode,
    userAssetBalance,
    shareBalance,
    shareBalanceInUsdc,
    assetDecimals,
    resolvedShareDecimals,
  ]);

  if (!open) return null;

  const title = mode === "deposit" ? `Deposit ${assetSymbol}` : `Withdraw ${assetSymbol}`;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      showCloseButton
      className="max-w-lg bg-white text-slate-900"
    >
      <form
        className="mt-6 flex w-full flex-col gap-5 text-sm text-slate-700"
        onSubmit={handleSubmit}
      >
        {mode === "withdraw" && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase">Withdraw by</span>
            <div
              className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5"
              role="group"
              aria-label="Withdraw input mode"
            >
              <button
                type="button"
                onClick={() => {
                  setWithdrawInputMode("shares");
                  setInputAmount("");
                  setErrorMessage(null);
                }}
                className={
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition " +
                  (withdrawInputMode === "shares"
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-600 hover:text-slate-900")
                }
                aria-pressed={withdrawInputMode === "shares"}
                aria-label="Enter amount in shares"
              >
                Shares
              </button>
              <button
                type="button"
                onClick={() => {
                  setWithdrawInputMode("asset");
                  setInputAmount("");
                  setErrorMessage(null);
                }}
                className={
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition " +
                  (withdrawInputMode === "asset"
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-600 hover:text-slate-900")
                }
                aria-pressed={withdrawInputMode === "asset"}
                aria-label={`Enter amount in ${assetSymbol}`}
              >
                {assetSymbol}
              </button>
            </div>
          </div>
        )}
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase">
                {mode === "deposit"
                  ? `${assetSymbol} Amount`
                  : isWithdrawAssetMode
                    ? `${assetSymbol} to Withdraw`
                    : "Shares to Redeem"}
              </span>
              <span className="text-xs text-slate-500">
                Balance:{" "}
                {mode === "deposit"
                  ? isBalanceLoading
                    ? "Loading..."
                    : formatUnits(userAssetBalance, assetDecimals)
                  : isShareBalanceUsdcLoading
                    ? "Loading..."
                    : shareBalance === 0n
                      ? `0 shares`
                      : isShareDecimalsLoading
                        ? "Loading shares..."
                        : `${formatVaultShares(shareBalance, resolvedShareDecimals ?? 18)} shares${
                            shareBalanceInUsdc != null
                              ? ` (≈ ${shareBalanceInUsdc} ${assetSymbol})`
                              : ""
                          }`}
              </span>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={inputAmount}
              onChange={(e) => {
                setInputAmount(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="0.00"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-500 focus:outline-none"
              aria-label={
                mode === "deposit"
                  ? "Amount to deposit"
                  : isWithdrawAssetMode
                    ? `${assetSymbol} amount to withdraw`
                    : "Shares to redeem"
              }
            />
            <button
              type="button"
              onClick={handleMaxClick}
              disabled={
                mode === "withdraw" &&
                (isShareDecimalsLoading ||
                  (withdrawInputMode === "asset" &&
                    (shareBalanceInUsdcUnits == null ||
                      isShareBalanceUsdcLoading ||
                      shareBalanceInUsdcUnits === 0n)))
              }
              className="self-end text-xs font-medium text-slate-600 underline hover:text-slate-800 disabled:no-underline disabled:opacity-50"
            >
              Max
            </button>
            {mode === "deposit" && expectedShares != null && (
              <p className="text-xs text-slate-500">
                You will receive approximately {expectedShares} vault shares
              </p>
            )}
            {mode === "withdraw" && withdrawInputMode === "shares" && expectedAssets != null && (
              <p className="text-xs text-slate-500">
                {normalizedInputAmount != null && (
                  <>
                    {normalizedInputAmount} shares ≈ {expectedAssets} {assetSymbol}
                    <br />
                  </>
                )}
                You will receive approximately {expectedAssets} {assetSymbol}
              </p>
            )}
            {mode === "withdraw" && withdrawInputMode === "asset" && (
              <p className="text-xs text-slate-500">
                You will withdraw {normalizedInputAmount || "0"} {assetSymbol}
                {expectedSharesToBurnUnits != null && (
                  <>
                    <br />
                    Shares to burn:{" "}
                    {formatVaultShares(
                      expectedSharesToBurnUnits,
                      expectedSharesToBurnDecimals
                    )}{" "}
                    shares
                  </>
                )}
              </p>
            )}
          </label>
        </section>

        {errorMessage ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !hasPositiveInput ||
              inputUnits == null ||
              (mode === "withdraw" && isShareDecimalsLoading)
            }
            className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {isSubmitting ? "Confirming..." : mode === "deposit" ? "Deposit" : "Withdraw"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
