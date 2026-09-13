"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/common/PrimaryButton";

interface TermsAcceptanceProps {
  onAccept: (timestamp: string) => void;
  isLoading: boolean;
}

export function TermsAcceptance({ onAccept, isLoading }: TermsAcceptanceProps) {
  const [checked, setChecked] = useState(false);

  const handleProceed = () => {
    if (checked) {
      onAccept(new Date().toISOString());
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-center text-sm font-semibold text-black">Legal Authorization</h3>
      <p className="text-center text-xs text-gray-900">
        To proceed with your USDC purchase, please review and accept the following agreements from
        our infrastructure partner, Coinbase.
      </p>

      <div className="flex items-start gap-3 rounded-lg border border-gray-600 p-3">
        <input
          type="checkbox"
          id="coinbase-terms"
          className="mt-0.5"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <label htmlFor="coinbase-terms" className="text-xs leading-relaxed text-gray-900">
          I agree to the Creative Finance Terms and acknowledge that fiat-to-crypto services are
          provided by Coinbase. I specifically agree to the{" "}
          <a
            href="https://www.coinbase.com/legal/coinbase-payments/terms-of-service"
            target="_blank"
            className="text-blue-600 underline"
          >
            Guest Checkout Terms
          </a>
          , the{" "}
          <a
            href="https://www.coinbase.com/legal/user_agreement"
            target="_blank"
            className="text-blue-600 underline"
          >
            User Agreement
          </a>
          , and acknowledge the{" "}
          <a
            href="https://www.coinbase.com/legal/privacy"
            target="_blank"
            className="text-blue-600 underline"
          >
            Privacy Policy
          </a>
          .
        </label>
      </div>

      <PrimaryButton disabled={!checked || isLoading} onClick={handleProceed}>
        {isLoading ? "Processing..." : "Confirm and View Quote"}
      </PrimaryButton>
    </div>
  );
}
