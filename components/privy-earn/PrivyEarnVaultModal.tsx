"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAuth } from "@/context/AuthContext";
import { Modal } from "@/components/common/Modal";
import { usePrivyEarnAction } from "@/hooks/usePrivyEarn";
import { PRIVY_EARN_DISCLAIMER } from "@/lib/config/privyEarn";
import {
  normalizeTxErrorMessage,
  showTxErrorToast,
  showTxSuccessToast,
} from "@/lib/transactionToast";
import type { PrivyEarnPositionPublic, PrivyEarnVaultPublic } from "@/lib/privyEarnTypes";
import { parseInputAmount } from "@/lib/yearnUtils";

type PrivyEarnVaultModalProps = {
  open: boolean;
  onClose: () => void;
  mode: "deposit" | "withdraw";
  vault: PrivyEarnVaultPublic | null;
  position: PrivyEarnPositionPublic | null;
  userAssetBalance: bigint;
  isBalanceLoading?: boolean;
};

const formatToken = (raw: string, decimals: number): string => {
  try {
    return formatUnits(BigInt(raw), decimals);
  } catch {
    return "0";
  }
};

export const PrivyEarnVaultModal = ({
  open,
  onClose,
  mode,
  vault,
  position,
  userAssetBalance,
  isBalanceLoading = false,
}: PrivyEarnVaultModalProps) => {
  const { status: authStatus, login } = useAuth();
  const { submit } = usePrivyEarnAction();
  const [inputAmount, setInputAmount] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const assetSymbol = (vault?.asset.symbol ?? "usdc").toUpperCase();
  const decimals = vault?.asset.decimals ?? 6;
  const withdrawable = position ? formatToken(position.assetsInVault, decimals) : "0";
  const withdrawableRaw = position ? BigInt(position.assetsInVault) : 0n;

  const parsedAmount = useMemo(
    () => parseInputAmount(inputAmount, decimals),
    [inputAmount, decimals]
  );

  const resetForm = useCallback(() => {
    setInputAmount("");
    setValidationError(null);
    setIsSubmitting(false);
    setIsComplete(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  }, [isSubmitting, onClose, resetForm]);

  const validate = useCallback((): string | null => {
    if (authStatus !== "logged-in") {
      return "Sign in to continue.";
    }
    if (!parsedAmount || parsedAmount === 0n) {
      return "Please enter a valid amount.";
    }
    if (mode === "deposit") {
      if (isBalanceLoading) return "Balance is loading. Please wait...";
      if (parsedAmount > userAssetBalance) {
        return `Insufficient ${assetSymbol} balance.`;
      }
      return null;
    }
    if (parsedAmount > withdrawableRaw) {
      return `Insufficient ${assetSymbol} in vault.`;
    }
    if (
      vault?.availableLiquidityUsd != null &&
      Number(formatUnits(parsedAmount, decimals)) > vault.availableLiquidityUsd
    ) {
      return "This withdrawal exceeds available vault liquidity. Try a smaller amount.";
    }
    return null;
  }, [
    assetSymbol,
    authStatus,
    decimals,
    isBalanceLoading,
    mode,
    parsedAmount,
    userAssetBalance,
    vault?.availableLiquidityUsd,
    withdrawableRaw,
  ]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setValidationError(null);

      if (authStatus !== "logged-in") {
        login();
        setValidationError("Sign in to continue.");
        return;
      }

      const validationMessage = validate();
      if (validationMessage) {
        setValidationError(validationMessage);
        return;
      }

      const isMaxWithdraw =
        mode === "withdraw" && parsedAmount != null && parsedAmount === withdrawableRaw;

      setIsSubmitting(true);
      try {
        const action = await submit(
          mode === "deposit"
            ? { mode: "deposit", amount: inputAmount.trim() }
            : { mode: "withdraw", amount: inputAmount.trim(), max: isMaxWithdraw }
        );

        if (action.status === "succeeded") {
          showTxSuccessToast({
            title: mode === "deposit" ? "Deposit confirmed" : "Withdraw confirmed",
            description:
              action.amount != null
                ? `${action.amount} ${assetSymbol}`
                : "Your Privy Earn position has updated.",
            txHash: action.txHash,
          });
          setIsComplete(true);
          return;
        }

        const reason =
          action.failureReason ??
          (action.status === "rejected"
            ? "The request was rejected before it reached the chain."
            : "The transaction failed onchain.");
        showTxErrorToast({
          title: mode === "deposit" ? "Deposit failed" : "Withdraw failed",
          description: reason,
        });
        setValidationError(reason);
      } catch (error) {
        const message = normalizeTxErrorMessage(error, "Transaction failed");
        showTxErrorToast({
          title: mode === "deposit" ? "Deposit failed" : "Withdraw failed",
          description: message,
        });
        setValidationError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      assetSymbol,
      authStatus,
      inputAmount,
      login,
      mode,
      parsedAmount,
      submit,
      validate,
      withdrawableRaw,
    ]
  );

  const handleMaxClick = useCallback(() => {
    if (mode === "deposit") {
      setInputAmount(formatUnits(userAssetBalance, decimals));
      return;
    }
    setInputAmount(withdrawable);
  }, [decimals, mode, userAssetBalance, withdrawable]);

  if (!open) return null;

  const modalTitle = mode === "deposit" ? `Deposit ${assetSymbol}` : `Withdraw ${assetSymbol}`;
  const submitLabel = isSubmitting
    ? "Confirming..."
    : isComplete
      ? "Complete"
      : mode === "deposit"
        ? "Deposit"
        : "Withdraw";

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
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase">
                {assetSymbol} Amount
              </span>
              <span className="text-xs text-slate-500">
                {mode === "deposit"
                  ? `Balance: ${isBalanceLoading ? "Loading..." : formatUnits(userAssetBalance, decimals)}`
                  : `In vault: ${withdrawable}`}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={inputAmount}
                onChange={(event) => setInputAmount(event.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                placeholder="0.00"
                required
                aria-label={`${assetSymbol} amount`}
                disabled={isSubmitting || isComplete}
              />
              <button
                type="button"
                onClick={handleMaxClick}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                tabIndex={0}
                aria-label={`Use maximum ${assetSymbol}`}
                disabled={isSubmitting || isComplete}
              >
                MAX
              </button>
            </div>
          </label>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <h4 className="text-base font-semibold">Vault</h4>
          <div className="flex justify-between">
            <span className="text-emerald-700">Name</span>
            <span className="font-medium">{vault?.name ?? "Privy Earn"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-emerald-700">Asset</span>
            <span className="font-medium">{assetSymbol}</span>
          </div>
        </section>

        <p className="text-xs leading-5 text-slate-500">{PRIVY_EARN_DISCLAIMER}</p>

        {validationError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {validationError}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 md:flex-row md:flex-row-reverse md:justify-end">
          <button
            type="submit"
            className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:border-slate-700 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
            disabled={isSubmitting || isComplete}
            tabIndex={0}
            aria-label={mode === "deposit" ? "Deposit assets" : "Withdraw assets"}
          >
            {submitLabel}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
            tabIndex={0}
            disabled={isSubmitting}
          >
            {isComplete ? "Close" : "Cancel"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
