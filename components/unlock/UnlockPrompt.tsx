"use client";

import { useMemo, useState } from "react";

import { MEMBERSHIP_LOCKS, TIER_PRICING, type MembershipTier } from "@/lib/config/memberships";
import { unlockChainLabel } from "@/lib/config/unlock";
import { useMembership } from "@/context/MembershipContext";
import { formatDateMs } from "@/lib/formatters";
import { CheckoutIframe } from "./CheckoutIframe";

const formatLockAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

type UnlockPromptProps = {
  currentTier?: MembershipTier | null;
};

export function UnlockPrompt({ currentTier }: UnlockPromptProps) {
  const membership = useMembership();
  const [showCheckout, setShowCheckout] = useState(false);

  const sortedLocks = useMemo(
    () =>
      [...MEMBERSHIP_LOCKS].sort((a, b) => {
        if (a.priority === b.priority) {
          return a.tier.localeCompare(b.tier);
        }
        return b.priority - a.priority;
      }),
    []
  );

  const hasAnyKey = sortedLocks.some((lock) => membership.locks[lock.tier]?.hasValidKey);

  if (showCheckout) {
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <CheckoutIframe
          onClose={() => {
            setShowCheckout(false);
            membership.refresh();
          }}
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">
          Creative Membership
        </p>
        <h3 className="text-xl font-semibold text-emerald-900">Premium Access Required</h3>
        <p className="text-sm text-emerald-800">
          Access to this feature requires a Creative membership NFT on {unlockChainLabel}. Choose
          from three tiers to unlock premium features and lower fees.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {sortedLocks.map((lock) => {
          const state = membership.locks[lock.tier];
          const hasKey = Boolean(state?.hasValidKey);
          const expiresAt = state?.expiresAtMs ? formatDateMs(state.expiresAtMs) : null;
          const pricing = TIER_PRICING[lock.tier];

          return (
            <div
              key={lock.address}
              className="flex flex-col justify-between gap-2 rounded-xl border border-emerald-200 bg-white/80 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-base font-semibold text-slate-900">{lock.tier}</span>
                  <span className="text-xs text-slate-600">
                    {pricing.price} / {pricing.duration}
                  </span>
                </div>
                {hasKey && (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                    Active
                  </span>
                )}
              </div>
              {hasKey && expiresAt && (
                <span className="text-xs text-emerald-600">Valid until {expiresAt}</span>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="w-full rounded-lg border border-emerald-700 bg-emerald-700 px-6 py-3 text-base font-semibold text-white transition hover:border-emerald-800 hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        onClick={() => setShowCheckout(true)}
      >
        {hasAnyKey ? "Manage Membership" : "Get Creative Membership"}
      </button>

      {currentTier && (
        <p className="text-xs text-emerald-700">
          Current tier: <strong>{currentTier}</strong>. A higher tier is required for this feature.
        </p>
      )}
    </section>
  );
}
