"use client";

import { useState } from "react";
import { useNexusCoverQuote } from "@/hooks/useNexusCoverQuote";
import { NexusCoverModal } from "./NexusCoverModal";

interface CoverPromptProps {
  /** Nexus Mutual product ID (97 = Aave, 123 = Yearn) */
  productId: number;
  productLabel: string;
  /** Deposit amount in wei (for pre-filling cover amount) */
  depositAmountWei: string;
  assetSymbol: string;
  assetDecimals: number;
  buyerAddress: `0x${string}`;
  onSkip: () => void;
}

/**
 * Post-deposit prompt encouraging users to protect their position
 * with Nexus Mutual cover. Appears inline after a successful vault deposit.
 */
export function CoverPrompt({
  productId,
  productLabel,
  depositAmountWei,
  assetSymbol,
  assetDecimals,
  buyerAddress,
  onSkip,
}: CoverPromptProps) {
  const [showCoverModal, setShowCoverModal] = useState(false);

  const displayAmount = (Number(depositAmountWei) / Math.pow(10, assetDecimals)).toFixed(2);

  if (showCoverModal) {
    return (
      <NexusCoverModal
        open={showCoverModal}
        onClose={() => {
          setShowCoverModal(false);
          onSkip();
        }}
        productId={productId}
        productLabel={productLabel}
        assetSymbol={assetSymbol}
        assetDecimals={assetDecimals}
        suggestedAmountWei={BigInt(depositAmountWei)}
        buyerAddress={buyerAddress}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🛡️</span>
        <h4 className="text-sm font-semibold text-emerald-900">Protect Your Deposit</h4>
      </div>

      <p className="text-xs text-emerald-800">
        Your{" "}
        <strong>
          {displayAmount} {assetSymbol}
        </strong>{" "}
        deposit in the {productLabel} vault is unprotected. Get Nexus Mutual cover to insure against
        smart contract risks.
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => setShowCoverModal(true)}
          className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
        >
          Get Cover
        </button>
        <button
          onClick={onSkip}
          className="rounded-lg border border-emerald-300 px-4 py-2 text-sm text-emerald-700 transition hover:bg-emerald-100"
        >
          Skip
        </button>
      </div>

      <p className="text-xs text-emerald-600">
        Cover is purchased on Ethereum mainnet. A 14-day cooling period applies before claims can be
        filed.
      </p>
    </div>
  );
}
