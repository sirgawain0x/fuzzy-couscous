"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Address, formatUnits, createWalletClient, custom, type WalletClient } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { useAuth } from "@/context/AuthContext";
import { useWallet, EVMWallet } from "@crossmint/client-sdk-react-ui";
import { base } from "viem/chains";
import {
  normalizeTxErrorMessage,
  showTxErrorToast,
  showTxSuccessToast,
} from "@/lib/transactionToast";

import { Modal } from "@/components/common/Modal";
import { CoverPrompt } from "@/components/nexus/CoverPrompt";
import { NEXUS_YEARN_V3_PRODUCT_ID } from "@/lib/config/nexus-mutual";
import { useYearnDeposit } from "@/hooks/useYearnDeposit";
import { useYearnWithdraw } from "@/hooks/useYearnWithdraw";
import {
  useYearnVaultBalance,
  usePreviewDeposit,
  usePreviewRedeem,
  useMaxDeposit,
} from "@/hooks/useYearnVaults";
import { MAX_LOSS_BPS } from "@/lib/config/yearn";
import { parseInputAmount, formatVaultShares, formatUsdValue } from "@/lib/yearnUtils";

type YearnVaultModalProps = {
  open: boolean;
  onClose: () => void;
  vaultAddress?: Address;
  assetAddress?: Address;
  assetSymbol?: string;
  mode: "deposit" | "withdraw";
  userAssetBalance?: bigint;
  assetDecimals?: number;
  /** Vault share token decimals (from vault decimals()). Used so share display matches USDC scale. */
  shareDecimals?: number;
  isBalanceLoading?: boolean;
};

export const YearnVaultModal = ({
  open,
  onClose,
  vaultAddress,
  assetAddress,
  assetSymbol = "USDC",
  mode,
  userAssetBalance = 0n,
  assetDecimals = 6,
  shareDecimals = 18,
  isBalanceLoading = false,
}: YearnVaultModalProps) => {
  const { address: wagmiAddress } = useAccount();
  const { data: wagmiWalletClient } = useWalletClient();
  const { wallet: crossmintWallet, status: walletStatus } = useWallet();
  const { status: authStatus } = useAuth();

  // Determine active address (Crossmint takes priority, fallback to wagmi)
  const userAddress = useMemo(() => {
    if (crossmintWallet?.address) {
      return crossmintWallet.address as `0x${string}`;
    }
    return wagmiAddress;
  }, [crossmintWallet?.address, wagmiAddress]);

  // Create wallet client from Crossmint wallet if available, otherwise use wagmi client
  const walletClient = useMemo((): WalletClient | undefined => {
    // If we have a Crossmint wallet, create a viem wallet client adapter
    if (crossmintWallet) {
      try {
        const evmWallet = EVMWallet.from(crossmintWallet);
        // Yearn/Kalani vaults are on Base mainnet only; always use base for this modal
        const chain = base;

        // Create a custom wallet client that uses Crossmint's EVMWallet for transactions
        return createWalletClient({
          chain,
          transport: custom({
            async request({ method, params }) {
              // Handle transaction sending through Crossmint's EVMWallet
              if (method === "eth_sendTransaction" && params?.[0]) {
                const tx = params[0] as {
                  to?: string;
                  value?: string;
                  data?: string;
                  gas?: string;
                  gasPrice?: string;
                  maxFeePerGas?: string;
                  maxPriorityFeePerGas?: string;
                };

                // Validate required fields
                if (!tx.to) {
                  throw new Error("Transaction 'to' address is required");
                }

                // Convert viem transaction format to Crossmint format
                const valueHex = tx.value || "0x0";
                const valueBigInt = BigInt(valueHex);

                const transaction = {
                  to: tx.to as `0x${string}`,
                  value: valueBigInt,
                  data: (tx.data || "0x") as `0x${string}`,
                };

                // Send transaction using Crossmint's EVMWallet
                const result = await evmWallet.sendTransaction(transaction);

                // Return the transaction hash in the format viem expects
                return result.hash;
              }

              // Handle account requests
              if (method === "eth_accounts" || method === "eth_requestAccounts") {
                return [crossmintWallet.address];
              }

              // Handle chain ID requests
              if (method === "eth_chainId") {
                return `0x${chain.id.toString(16)}`;
              }

              // For other methods, you might need to implement them or throw
              throw new Error(`Method ${method} not yet supported with Crossmint wallet adapter`);
            },
          }),
        });
      } catch (error) {
        console.error("Failed to create wallet client from Crossmint wallet:", error);
      }
    }

    // Fallback to wagmi wallet client
    return wagmiWalletClient ?? undefined;
  }, [crossmintWallet, wagmiWalletClient]);

  const [inputAmount, setInputAmount] = useState("");
  const [maxLossPercent, setMaxLossPercent] = useState(1); // Default 1% max loss
  const [validationError, setValidationError] = useState<string | null>(null);

  // Hooks for vault interactions - pass wallet client for Crossmint support
  const {
    deposit,
    state: depositState,
    reset: resetDeposit,
  } = useYearnDeposit(vaultAddress, assetAddress, walletClient);
  const {
    redeem,
    state: withdrawState,
    reset: resetWithdraw,
  } = useYearnWithdraw(vaultAddress, walletClient);

  // Get user's vault balance
  const {
    shareBalance,
    assetValue,
    refetch: refetchBalance,
  } = useYearnVaultBalance(vaultAddress, userAddress);

  // Parse input amount to bigint
  // In withdraw mode, we're entering shares (shareDecimals)
  // In deposit mode, we're entering assets (assetDecimals)
  const [showCoverPrompt, setShowCoverPrompt] = useState(false);
  const [lastDepositAmountWei, setLastDepositAmountWei] = useState<string>("0");

  const parsedAmount = useMemo(() => {
    const decimals = mode === "withdraw" ? shareDecimals : assetDecimals;
    return parseInputAmount(inputAmount, decimals);
  }, [inputAmount, assetDecimals, shareDecimals, mode]);

  // Preview deposit (get expected shares)
  const { expectedShares } = usePreviewDeposit(
    vaultAddress,
    mode === "deposit" ? (parsedAmount ?? undefined) : undefined
  );

  // Preview withdrawal (get expected assets)
  const { expectedAssets } = usePreviewRedeem(
    vaultAddress,
    mode === "withdraw" ? (parsedAmount ?? undefined) : undefined
  );

  // Check max deposit for validation
  const { maxDeposit } = useMaxDeposit(vaultAddress, mode === "deposit" ? userAddress : undefined);

  const state = mode === "deposit" ? depositState : withdrawState;
  const isSubmitting =
    state.status === "approving" || state.status === "depositing" || state.status === "redeeming";

  const resetForm = useCallback(() => {
    setInputAmount("");
    setMaxLossPercent(1);
    setValidationError(null);
    resetDeposit();
    resetWithdraw();
  }, [resetDeposit, resetWithdraw]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handledSuccessTxHashRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    if (state.status !== "success") return;
    if (!state.txHash) return;
    if (handledSuccessTxHashRef.current === state.txHash) return;

    handledSuccessTxHashRef.current = state.txHash;

    const vaultShort = vaultAddress
      ? `${vaultAddress.slice(0, 6)}...${vaultAddress.slice(-4)}`
      : "this vault";

    if (mode === "deposit") {
      const depositAssetsWei = parsedAmount ?? 0n;
      const depositAssetsFormatted = formatUnits(depositAssetsWei, assetDecimals);
      const expectedSharesFormatted =
        expectedShares != null ? formatVaultShares(expectedShares, shareDecimals) : undefined;

      showTxSuccessToast({
        title: "Deposit complete",
        description: expectedSharesFormatted
          ? `${depositAssetsFormatted} ${assetSymbol} deposited into ${vaultShort}. Expected ${expectedSharesFormatted} shares.`
          : `${depositAssetsFormatted} ${assetSymbol} deposited into ${vaultShort}.`,
        txHash: state.txHash,
      });

      // Show cover prompt instead of auto-closing
      setLastDepositAmountWei(depositAssetsWei.toString());
      setShowCoverPrompt(true);
      return; // Don't auto-close — let CoverPrompt handle it
    } else {
      const redeemedSharesWei = parsedAmount ?? 0n;
      const redeemedSharesFormatted = formatVaultShares(redeemedSharesWei, shareDecimals);
      const expectedWithdrawAssetsFormatted =
        expectedAssets != null ? formatUnits(expectedAssets, assetDecimals) : undefined;

      showTxSuccessToast({
        title: "Withdraw complete",
        description: expectedWithdrawAssetsFormatted
          ? `Redeemed ${redeemedSharesFormatted} shares for ~${expectedWithdrawAssetsFormatted} ${assetSymbol} from ${vaultShort}.`
          : `Redeemed ${redeemedSharesFormatted} shares from ${vaultShort}.`,
        txHash: state.txHash,
      });
    }

    const timer = window.setTimeout(() => {
      handleClose();
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    open,
    state.status,
    state.txHash,
    mode,
    parsedAmount,
    vaultAddress,
    assetDecimals,
    assetSymbol,
    expectedShares,
    expectedAssets,
    shareDecimals,
    handleClose,
  ]);

  const handledErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    if (state.status !== "error" || !state.error) return;
    if (handledErrorRef.current === state.error) return;
    handledErrorRef.current = state.error;
    showTxErrorToast({
      title: mode === "deposit" ? "Deposit failed" : "Withdraw failed",
      description: normalizeTxErrorMessage(state.error, "Transaction failed"),
    });
  }, [open, state.status, state.error, mode]);

  const validate = useCallback(() => {
    if (!userAddress) {
      // Provide more helpful error message
      if (authStatus === "initializing" || walletStatus === "in-progress") {
        return "Wallet is connecting. Please wait...";
      }
      return "Connect a wallet to continue.";
    }

    if (!vaultAddress || !assetAddress) {
      return "Vault information is not available.";
    }

    if (!parsedAmount || parsedAmount === 0n) {
      return "Please enter a valid amount.";
    }

    if (mode === "deposit") {
      // Block transaction if balance is still loading
      if (isBalanceLoading) {
        return "Balance is loading. Please wait...";
      }

      // Ensure we have a valid balance before checking
      if (userAssetBalance === undefined) {
        return "Unable to fetch balance. Please try again.";
      }

      if (parsedAmount > userAssetBalance) {
        return `Insufficient ${assetSymbol} balance.`;
      }

      // Check maxDeposit limit
      if (maxDeposit !== undefined) {
        if (maxDeposit === 0n) {
          return "Vault deposits are currently unavailable. The vault may be paused or at capacity.";
        }
        if (parsedAmount > maxDeposit) {
          const maxFormatted = formatUnits(maxDeposit, assetDecimals);
          return `Deposit amount exceeds maximum allowed (${maxFormatted} ${assetSymbol}). Please try a smaller amount.`;
        }
      }
    } else {
      if (!shareBalance || parsedAmount > shareBalance) {
        return "Insufficient vault shares to withdraw.";
      }
    }

    if (maxLossPercent < 0 || maxLossPercent > 100) {
      return "Max loss must be between 0% and 100%.";
    }

    return null;
  }, [
    userAddress,
    vaultAddress,
    assetAddress,
    parsedAmount,
    mode,
    userAssetBalance,
    assetSymbol,
    shareBalance,
    maxLossPercent,
    authStatus,
    walletStatus,
    isBalanceLoading,
    maxDeposit,
    assetDecimals,
  ]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setValidationError(null);

      const validationMessage = validate();
      if (validationMessage) {
        setValidationError(validationMessage);
        if (mode === "deposit") {
          resetDeposit();
        } else {
          resetWithdraw();
        }
        return;
      }

      if (!userAddress || !vaultAddress || !parsedAmount) {
        setValidationError("Missing required information. Please try again.");
        return;
      }

      if (mode === "deposit") {
        await deposit(parsedAmount, userAddress);
      } else {
        const maxLossBps = Math.floor(maxLossPercent * 100);
        await redeem(parsedAmount, userAddress, userAddress, maxLossBps);
      }

      // Refetch balance after transaction
      setTimeout(() => {
        refetchBalance();
      }, 2000);
    },
    [
      validate,
      mode,
      userAddress,
      vaultAddress,
      parsedAmount,
      maxLossPercent,
      deposit,
      redeem,
      resetDeposit,
      resetWithdraw,
      refetchBalance,
    ]
  );

  const handleMaxClick = useCallback(() => {
    if (mode === "deposit") {
      setInputAmount(formatUnits(userAssetBalance, assetDecimals));
    } else if (shareBalance) {
      setInputAmount(formatUnits(shareBalance, shareDecimals));
    }
  }, [mode, userAssetBalance, assetDecimals, shareBalance, shareDecimals]);

  if (!open) {
    return null;
  }

  const modalTitle = mode === "deposit" ? `Deposit ${assetSymbol}` : `Withdraw ${assetSymbol}`;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={modalTitle}
      showCloseButton
      className="max-w-lg bg-white text-slate-900"
    >
      <form
        className="mt-6 flex w-full flex-col gap-5 text-sm text-slate-700"
        onSubmit={handleSubmit}
      >
        {/* Amount Input */}
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase">
                {mode === "deposit" ? `${assetSymbol} Amount` : "Shares to Redeem"}
              </span>
              <span className="text-xs text-slate-500">
                Balance:{" "}
                {mode === "deposit"
                  ? isBalanceLoading
                    ? "Loading..."
                    : formatUnits(userAssetBalance, assetDecimals)
                  : shareBalance
                    ? formatVaultShares(shareBalance, shareDecimals)
                    : "0"}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputAmount}
                onChange={(event) => setInputAmount(event.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                placeholder="0.00"
                required
              />
              <button
                type="button"
                onClick={handleMaxClick}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                MAX
              </button>
            </div>
          </label>

          {/* Preview */}
          {mode === "deposit" && expectedShares && (
            <div className="flex items-center justify-between rounded-lg bg-white p-3 text-sm">
              <span className="text-slate-500">Expected Shares:</span>
              <span className="font-medium text-slate-900">
                {formatVaultShares(expectedShares, shareDecimals)}
              </span>
            </div>
          )}

          {mode === "withdraw" && expectedAssets && (
            <div className="flex items-center justify-between rounded-lg bg-white p-3 text-sm">
              <span className="text-slate-500">Expected {assetSymbol}:</span>
              <span className="font-medium text-slate-900">
                {formatUnits(expectedAssets, assetDecimals)}
              </span>
            </div>
          )}
        </section>

        {/* Max Loss Setting (for withdrawals) */}
        {mode === "withdraw" && (
          <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Max Loss Protection</h4>
              <p className="text-xs text-slate-500">
                Transaction will revert if loss exceeds this percentage
              </p>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-500 uppercase">
                Max Loss Percentage
              </span>
              <input
                type="number"
                step="0.1"
                min={0}
                max={100}
                value={maxLossPercent}
                onChange={(event) => setMaxLossPercent(Number(event.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              />
              <span className="text-xs text-slate-500">
                Recommended: 1% for standard withdrawals
              </span>
            </label>
          </section>
        )}

        {/* Vault Info */}
        <section className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <h4 className="text-base font-semibold">Vault Information</h4>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-emerald-700">Asset:</span>
              <span className="font-medium">{assetSymbol}</span>
            </div>
            {mode === "withdraw" && assetValue && (
              <div className="flex justify-between">
                <span className="text-emerald-700">Your Position Value:</span>
                <span className="font-medium">
                  {formatUnits(assetValue, assetDecimals)} {assetSymbol}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Validation Error Message */}
        {validationError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {validationError}
          </p>
        )}

        {/* Transaction Error Message */}
        {state.status === "error" && state.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        {/* Success Message */}
        {state.status === "success" && state.txHash && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Transaction successful!{" "}
            <a
              href={`https://basescan.org/tx/${state.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on Basescan
            </a>
          </p>
        )}

        {/* Form Actions */}
        <div className="flex flex-col gap-2 md:flex-row md:flex-row-reverse md:justify-end">
          <button
            type="submit"
            className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:border-slate-700 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
            disabled={isSubmitting || state.status === "success"}
            tabIndex={0}
            aria-label={mode === "deposit" ? "Deposit assets" : "Withdraw assets"}
          >
            {state.status === "approving"
              ? "Approving..."
              : state.status === "depositing"
                ? "Depositing..."
                : state.status === "redeeming"
                  ? "Withdrawing..."
                  : state.status === "success"
                    ? "Complete"
                    : mode === "deposit"
                      ? "Deposit"
                      : "Withdraw"}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
            tabIndex={0}
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Cover prompt after successful deposit */}
      {showCoverPrompt && userAddress && (
        <CoverPrompt
          productId={NEXUS_YEARN_V3_PRODUCT_ID}
          productLabel="Yearn v3"
          depositAmountWei={lastDepositAmountWei}
          assetSymbol={assetSymbol}
          assetDecimals={assetDecimals}
          buyerAddress={userAddress}
          onSkip={() => {
            setShowCoverPrompt(false);
            handleClose();
          }}
        />
      )}
    </Modal>
  );
};
