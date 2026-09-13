"use client";

import { useState } from "react";
import { MEMBERSHIP_LOCKS, TIER_PRICING, type MembershipTier } from "@/lib/config/memberships";
import { CheckoutIframe } from "./CheckoutIframe";

interface MembershipOnboardingProps {
  onSkip: () => void;
  onPurchaseComplete: () => void;
}

/**
 * First-login blocking modal that explains membership tiers and their value.
 * Shows the 20% vs 10% fee comparison to drive conversion.
 */
export function MembershipOnboarding({ onSkip, onPurchaseComplete }: MembershipOnboardingProps) {
  const [showCheckout, setShowCheckout] = useState(false);

  const tiers = [...MEMBERSHIP_LOCKS].sort((a, b) => a.priority - b.priority);

  if (showCheckout) {
    return (
      <div className="flex h-full w-full items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
          <CheckoutIframe
            onClose={() => {
              setShowCheckout(false);
              onPurchaseComplete();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Maximize Your Yield</h2>
          <p className="mt-2 text-sm text-slate-600">
            Creative Finance members keep more of what they earn. Choose a tier to unlock lower fees
            and premium features.
          </p>
        </div>

        {/* Fee comparison */}
        <div className="mb-6 flex items-center justify-center gap-4">
          <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 px-6 py-4">
            <span className="text-xs font-medium text-slate-500 uppercase">Standard</span>
            <span className="text-3xl font-bold text-slate-400">20%</span>
            <span className="text-xs text-slate-500">performance fee</span>
          </div>
          <div className="text-2xl text-slate-300">→</div>
          <div className="flex flex-col items-center rounded-xl border-2 border-emerald-500 bg-emerald-50 px-6 py-4">
            <span className="text-xs font-medium text-emerald-600 uppercase">Member</span>
            <span className="text-3xl font-bold text-emerald-700">10%</span>
            <span className="text-xs text-emerald-600">performance fee</span>
          </div>
        </div>

        {/* Tier cards */}
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {tiers.map((lock) => {
            const pricing = TIER_PRICING[lock.tier];
            return (
              <div
                key={lock.address}
                className={`flex flex-col rounded-xl border p-4 ${
                  lock.tier === "Creative Brand"
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {lock.tier.replace("Creative ", "")}
                  </h3>
                  {lock.tier === "Creative Brand" && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Pro
                    </span>
                  )}
                </div>
                <div className="mb-3">
                  <span className="text-xl font-bold text-slate-900">{pricing.price}</span>
                  <span className="text-xs text-slate-500"> / {pricing.duration}</span>
                </div>
                <ul className="flex flex-col gap-1">
                  {pricing.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                      <span className="mt-0.5 text-emerald-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setShowCheckout(true)}
            className="w-full rounded-lg bg-emerald-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-emerald-800"
          >
            Get Membership
          </button>
          <button
            onClick={onSkip}
            className="w-full py-2 text-sm text-slate-500 transition hover:text-slate-700"
          >
            Skip for now — continue with standard 20% fees
          </button>
        </div>
      </div>
    </div>
  );
}
