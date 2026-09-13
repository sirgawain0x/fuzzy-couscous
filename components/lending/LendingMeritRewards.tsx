"use client";

import { useCallback, useState } from "react";
import { evmAddress, useUserMeritRewards } from "@aave/react";
import type { ChainId } from "@aave/react";
import { useSendTransaction } from "@aave/react/viem";

import { AAVE_TARGET_CHAIN_ID } from "@/lib/config/aave";
import type { WalletClient } from "viem";
import {
  normalizeTxErrorMessage,
  showTxErrorToast,
  showTxSuccessToast,
} from "@/lib/transactionToast";

type LendingMeritRewardsProps = {
  userEvm: ReturnType<typeof evmAddress>;
  walletClient: WalletClient | undefined;
  walletAddress: string | null;
  chainId?: ChainId;
};

export function LendingMeritRewards({
  userEvm,
  walletClient,
  walletAddress,
  chainId = AAVE_TARGET_CHAIN_ID,
}: LendingMeritRewardsProps) {
  const { data: meritRewards, loading: meritLoading } = useUserMeritRewards({
    user: userEvm,
    chainId,
  });
  const [sendTransaction, sending] = useSendTransaction(walletClient ?? undefined);
  const [meritError, setMeritError] = useState<string | null>(null);

  const handleClaimMerit = useCallback(async () => {
    if (meritRewards == null || !walletClient) return;
    setMeritError(null);
    const result = await sendTransaction(meritRewards.transaction);
    if (result.isErr()) {
      const message = normalizeTxErrorMessage(result.error, "Claim failed");
      setMeritError(message);
      showTxErrorToast({ title: "Claim failed", description: message });
      return;
    }
    const txHash = typeof result.value === "string" ? result.value : undefined;
    showTxSuccessToast({
      title: "Rewards claimed",
      description: "Merit rewards claimed successfully.",
      txHash,
    });
  }, [meritRewards, walletClient, sendTransaction]);

  if (!walletAddress) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Merit rewards</h2>
        <p className="text-sm text-slate-500">
          Connect a wallet to see and claim your Merit rewards.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Merit rewards</h2>
      {meritLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : meritRewards != null ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600">You have claimable rewards.</p>
          <button
            type="button"
            onClick={handleClaimMerit}
            disabled={sending.loading || !walletClient}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-fit rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {sending.loading ? "Claiming…" : "Claim rewards"}
          </button>
          {meritError && <p className="text-sm text-red-600">{meritError}</p>}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No claimable Merit rewards.</p>
      )}
    </section>
  );
}
