"use client";

import { useState } from "react";
import { useMembership } from "@/context/MembershipContext";
import { CheckoutIframe } from "./CheckoutIframe";
import { Modal } from "@/components/common/Modal";

/**
 * Persistent dashboard banner for non-members.
 * Soft nudge to upgrade — appears after the onboarding modal is dismissed.
 */
export function MembershipBanner() {
  const { tier, isLoading } = useMembership();
  const [showCheckout, setShowCheckout] = useState(false);

  // Don't show for members or while loading
  if (isLoading || tier !== null) return null;

  return (
    <>
      <div className="mx-auto mb-4 flex w-full max-w-5xl items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-amber-800">
            You&apos;re on the standard <strong>20% fee</strong> tier.
          </span>
          <button
            onClick={() => setShowCheckout(true)}
            className="text-sm font-semibold text-emerald-700 underline hover:text-emerald-800"
          >
            Upgrade to save 50% on fees
          </button>
        </div>
      </div>

      {showCheckout && (
        <Modal
          open={showCheckout}
          onClose={() => setShowCheckout(false)}
          showCloseButton
          title="Get Membership"
        >
          <CheckoutIframe onClose={() => setShowCheckout(false)} />
        </Modal>
      )}
    </>
  );
}
