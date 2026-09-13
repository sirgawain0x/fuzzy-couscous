"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Address, formatUnits, parseUnits } from "viem";
import { Modal } from "@/components/common/Modal";
import { useNexusCoverQuote } from "@/hooks/useNexusCoverQuote";
import { useNexusBuyCover } from "@/hooks/useNexusBuyCover";
import {
  getNexusCoverAssetId,
  NEXUS_MIN_COVER_PERIOD_DAYS,
  NEXUS_MAX_COVER_PERIOD_DAYS,
  NEXUS_MIN_COVER_USD,
  NEXUS_TERMS_LINKS,
  toBigIntSafe,
} from "@/lib/config/nexus-mutual";
import { toast } from "sonner";
import { mainnet } from "viem/chains";
import {
  normalizeTxErrorMessage,
  showTxErrorToast,
  showTxSuccessToast,
} from "@/lib/transactionToast";

export type NexusCoverProduct = "aave" | "yearn";

type NexusCoverModalProps = {
  open: boolean;
  onClose: () => void;
  productId: number;
  productLabel: string;
  assetSymbol: string;
  assetDecimals: number;
  /** Suggested cover amount in wei (e.g. from position value); used to prefill. */
  suggestedAmountWei?: bigint;
  buyerAddress: Address | undefined;
};

export function NexusCoverModal({
  open,
  onClose,
  productId,
  productLabel,
  assetSymbol,
  assetDecimals,
  suggestedAmountWei,
  buyerAddress,
}: NexusCoverModalProps) {
  const [amount, setAmount] = useState("");
  const [periodDays, setPeriodDays] = useState(90);
  const [acknowledged, setAcknowledged] = useState(false);

  const amountWei = useMemo(() => {
    const trimmed = amount.trim();
    if (!trimmed || trimmed === ".") return "0";
    try {
      return parseUnits(trimmed, assetDecimals).toString();
    } catch {
      return "0";
    }
  }, [amount, assetDecimals]);

  const coverAssetId = getNexusCoverAssetId(assetSymbol);

  const minWei = useMemo(() => {
    // Approximate the $100 USD minimum in the cover asset's own units. Stablecoins
    // (USDC/DAI) map ~1:1; ETH/cbBTC use rough fixed approximations so we don't
    // require 100 whole ETH/cbBTC of cover.
    const symbol = assetSymbol.toUpperCase();
    const minAmount = symbol === "ETH" ? "0.03" : symbol === "CBBTC" ? "0.001" : "100";
    try {
      return parseUnits(minAmount, assetDecimals);
    } catch {
      return parseUnits("100", 6);
    }
  }, [assetSymbol, assetDecimals]);

  const amountWeiBig = useMemo(() => {
    try {
      return BigInt(amountWei);
    } catch {
      return 0n;
    }
  }, [amountWei]);

  const hasAmount = amountWeiBig > 0n;
  const meetsMinimum = amountWeiBig >= minWei;

  const {
    result: quote,
    error: quoteError,
    loading: quoteLoading,
    refetch,
  } = useNexusCoverQuote({
    productId,
    amountWei,
    periodDays,
    coverAsset: coverAssetId,
    buyerAddress: open ? buyerAddress : undefined,
    // Only quote once the amount meets the minimum cover. Quoting sub-minimum
    // amounts makes the Nexus SDK throw a BigInt conversion error.
    enabled: open && meetsMinimum && !!buyerAddress,
  });

  const {
    buyCover,
    isPending: buyPending,
    isSuccess: buySuccess,
    txHash: buyTxHash,
    error: buyError,
    reset: resetBuy,
    isCorrectChain,
    switchToEthereum,
  } = useNexusBuyCover({
    quote: quote ?? null,
    enabled: open && !!quote && acknowledged,
  });

  const handleClose = useCallback(() => {
    setAmount("");
    setPeriodDays(90);
    setAcknowledged(false);
    resetBuy();
    onClose();
  }, [onClose, resetBuy]);

  useEffect(() => {
    if (buySuccess) {
      showTxSuccessToast({
        title: "Cover purchased",
        description: "Your position is protected by Nexus Mutual.",
        txHash: buyTxHash,
        chainId: mainnet.id,
      });
      handleClose();
    }
  }, [buySuccess, buyTxHash, handleClose]);

  const shownBuyErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!buyError) {
      shownBuyErrorRef.current = null;
      return;
    }
    const message = normalizeTxErrorMessage(buyError, "Cover purchase failed");
    if (shownBuyErrorRef.current === message) return;
    shownBuyErrorRef.current = message;
    showTxErrorToast({ title: "Cover purchase failed", description: message });
  }, [buyError]);

  const suggestedFormatted = useMemo(() => {
    if (suggestedAmountWei == null || suggestedAmountWei <= 0n) return "";
    return formatUnits(suggestedAmountWei, assetDecimals);
  }, [suggestedAmountWei, assetDecimals]);

  const handleUseSuggested = useCallback(() => {
    if (suggestedFormatted) setAmount(suggestedFormatted);
  }, [suggestedFormatted]);

  const minAmountFormatted = useMemo(
    () => formatUnits(minWei, assetDecimals),
    [minWei, assetDecimals]
  );

  const canSubmit =
    quote &&
    acknowledged &&
    meetsMinimum &&
    periodDays >= NEXUS_MIN_COVER_PERIOD_DAYS &&
    periodDays <= NEXUS_MAX_COVER_PERIOD_DAYS;

  const handleBuy = useCallback(() => {
    if (!canSubmit) return;
    if (!isCorrectChain) {
      switchToEthereum();
      toast.info("Switch your wallet to Ethereum mainnet to purchase cover.");
      return;
    }
    buyCover?.();
  }, [canSubmit, isCorrectChain, switchToEthereum, buyCover]);

  const isPayableInEth = quote?.buyCoverInput.buyCoverParams.paymentAsset === 0;
  const premiumFormatted = quote?.displayInfo.premiumInAsset
    ? formatUnits(toBigIntSafe(quote.displayInfo.premiumInAsset), assetDecimals)
    : null;
  const yearlyPerc =
    quote?.displayInfo.yearlyCostPerc != null
      ? `${(quote.displayInfo.yearlyCostPerc * 100).toFixed(2)}%`
      : null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Protect ${productLabel} with Nexus Mutual`}
      showCloseButton
      className="bg-white text-slate-900"
    >
      <div className="mt-4 flex w-full max-w-md flex-col gap-6">
        <p className="text-sm text-slate-600">
          Cover is purchased on Ethereum mainnet and protects your {productLabel} positions on Base.
        </p>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Cover amount ({assetSymbol})
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
              aria-label="Cover amount"
            />
            {suggestedFormatted && (
              <button
                type="button"
                onClick={handleUseSuggested}
                className="shrink-0 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Use position
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Minimum {minAmountFormatted} {assetSymbol} (${NEXUS_MIN_COVER_USD} equivalent).
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Cover period (days)</label>
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
            aria-label="Cover period in days"
          >
            {[28, 90, 180, 365].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Between {NEXUS_MIN_COVER_PERIOD_DAYS} and {NEXUS_MAX_COVER_PERIOD_DAYS} days.
          </p>
        </div>

        {hasAmount && !meetsMinimum && (
          <p className="text-sm text-amber-600">
            Minimum cover is {minAmountFormatted} {assetSymbol}. Increase the amount to get a quote.
          </p>
        )}
        {quoteLoading && meetsMinimum && <p className="text-sm text-slate-500">Loading quote…</p>}
        {quoteError && meetsMinimum && <p className="text-sm text-red-600">{quoteError.message}</p>}
        {quote && !quoteError && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">Quote</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>
                Premium: {premiumFormatted} {isPayableInEth ? "ETH" : assetSymbol}
              </li>
              {yearlyPerc && <li>Yearly cost: {yearlyPerc}</li>}
            </ul>
          </div>
        )}

        <div className="space-y-2 text-xs text-slate-600">
          <p>
            By buying Nexus Mutual Protocol Cover, you agree to the{" "}
            <a
              href={NEXUS_TERMS_LINKS.singleProtocol}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              terms
            </a>{" "}
            and{" "}
            <a
              href={NEXUS_TERMS_LINKS.conditions}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              conditions
            </a>
            .
          </p>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-slate-300"
              aria-label="Acknowledge claim and residency"
            />
            <span>
              By checking this box, you confirm that you do not reside in the countries listed in
              the{" "}
              <a
                href={NEXUS_TERMS_LINKS.restrictedCountries}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                linked page
              </a>
              , and acknowledge that in the event of a loss, you will be required to join as a
              member of Nexus Mutual to file your claim.
            </span>
          </label>
        </div>

        {buyError && <p className="text-sm text-red-600">{buyError.message}</p>}

        <div className="flex flex-col gap-2">
          {!isCorrectChain && (
            <button
              type="button"
              onClick={switchToEthereum}
              className="w-full rounded-xl border border-amber-500 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              Switch to Ethereum mainnet
            </button>
          )}
          <button
            type="button"
            disabled={!canSubmit || buyPending}
            onClick={handleBuy}
            className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buyPending
              ? "Confirm in wallet…"
              : !isCorrectChain
                ? "Switch network first"
                : "Buy Cover"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
