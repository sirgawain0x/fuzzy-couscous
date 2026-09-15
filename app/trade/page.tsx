"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { CopyWrapper } from "@/components/common/CopyWrapper";
import { TradeEligibilityGate } from "@/components/trade/TradeEligibilityGate";
import { TradeSwapPanel } from "@/components/trade/TradeSwapPanel";
import { useAuth } from "@/context/AuthContext";
import { useMembership } from "@/context/MembershipContext";
import { useAppWallet } from "@/hooks/useAppWallet";
import { shortenAddress } from "@/utils/shortenAddress";

export default function TradePage() {
  const { status: walletStatus, address } = useAppWallet();
  const { status: authStatus } = useAuth();
  const membership = useMembership();
  const [eligible, setEligible] = useState(false);

  const walletAddress = useMemo(() => {
    if (!address || authStatus !== "logged-in") return null;
    return address;
  }, [authStatus, address]);

  const walletStatusLabel = useMemo(() => {
    if (walletStatus === "in-progress" || authStatus === "initializing") return "Connecting...";
    if (!address || authStatus !== "logged-in") return "Not connected";
    return shortenAddress(address);
  }, [authStatus, address, walletStatus]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/"
            aria-label="Return to Creative Finance home"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            Back to Home
          </Link>
        </div>
        <div className="flex flex-col gap-3 rounded-3xl border border-white/40 bg-white/80 p-6 shadow-lg shadow-slate-900/10 backdrop-blur">
          <p className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
            Robinhood Chain
          </p>
          <h1 className="text-center text-3xl font-semibold text-slate-900 md:text-4xl">Trade</h1>
          <p className="mx-auto max-w-2xl text-center text-sm leading-6 text-slate-600">
            Swap Robinhood Stock Tokens against USDG via 0x RFQ liquidity on Robinhood Chain
            mainnet. Token addresses come only from the official RHJ asset registry.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            Connected Wallet:{" "}
            {walletAddress ? (
              <CopyWrapper
                toCopy={walletAddress}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
                iconPosition="right"
              >
                <span>{walletStatusLabel}</span>
              </CopyWrapper>
            ) : (
              <span>{walletStatusLabel}</span>
            )}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            Membership Tier: {membership.isLoading ? "Checking..." : (membership.tier ?? "None")}
          </span>
        </div>
      </header>

      {!eligible ? (
        <TradeEligibilityGate onReady={() => setEligible(true)} />
      ) : !walletAddress ? (
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 text-center text-sm text-slate-600">
          Sign in to connect your wallet and trade Stock Tokens on Robinhood Chain.
        </div>
      ) : (
        <TradeSwapPanel walletAddress={walletAddress} />
      )}
    </main>
  );
}
