"use client";

import { useState, useEffect } from "react";
import { PrimaryButton } from "@/components/common/PrimaryButton";

interface OnrampQuoteDisplayProps {
  paymentAmount: string;
  purchaseAmount: string;
  exchangeRate: string;
  fees: Array<{ type: string; amount: string; currency: string }>;
  paymentCurrency: string;
  purchaseCurrency: string;
  onConfirm: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function OnrampQuoteDisplay({
  paymentAmount,
  purchaseAmount,
  exchangeRate,
  fees,
  paymentCurrency,
  purchaseCurrency,
  onConfirm,
  onRefresh,
  isLoading,
}: OnrampQuoteDisplayProps) {
  const totalFees = fees.reduce((sum, f) => sum + Number(f.amount), 0);
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    setCountdown(15);
    const timer = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 15 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [purchaseAmount, exchangeRate]);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-center text-sm font-semibold text-black">Order Summary</h3>

      <div className="flex flex-col gap-2 rounded-lg border border-gray-600 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-900">You pay</span>
          <span className="font-medium text-black">
            ${paymentAmount} {paymentCurrency}
          </span>
        </div>

        {fees.map((fee, i) => (
          <div key={i} className="flex justify-between text-xs text-gray-900">
            <span>
              {fee.type === "FEE_TYPE_EXCHANGE"
                ? "Exchange fee"
                : fee.type === "FEE_TYPE_NETWORK"
                  ? "Network fee"
                  : "Fee"}
            </span>
            <span>
              -${Number(fee.amount).toFixed(2)} {fee.currency}
            </span>
          </div>
        ))}

        {totalFees > 0 && (
          <div className="border-t border-gray-500 pt-2">
            <div className="flex justify-between text-xs text-gray-900">
              <span>Total fees</span>
              <span>
                -${totalFees.toFixed(2)} {paymentCurrency}
              </span>
            </div>
          </div>
        )}

        <div className="border-t border-gray-600 pt-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-900">You receive</span>
            <span className="font-semibold text-emerald-700">
              ~{Number(purchaseAmount).toFixed(2)} {purchaseCurrency}
            </span>
          </div>
        </div>

        {exchangeRate && (
          <div className="flex justify-between text-xs text-gray-900">
            <span>Exchange rate</span>
            <span>
              1 {purchaseCurrency} = ${Number(exchangeRate).toFixed(4)} {paymentCurrency}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="rounded-md border border-gray-600 px-4 py-2 text-sm text-black transition-colors hover:bg-gray-500 disabled:opacity-50"
        >
          Refresh
        </button>
        <PrimaryButton onClick={onConfirm} disabled={isLoading}>
          {isLoading ? "Creating order..." : "Pay Now"}
        </PrimaryButton>
      </div>

      <p className="text-center text-xs text-gray-900">Quote auto-refreshes in {countdown}s</p>
    </div>
  );
}
