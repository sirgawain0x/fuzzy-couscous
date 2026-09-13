"use client";

import { useState, useCallback, useEffect } from "react";
import { evmAddress, useUserTransactionHistory, OrderDirection, PageSize } from "@aave/react";
import type { ChainId } from "@aave/react";

import { AAVE_TARGET_CHAIN_ID } from "@/lib/config/aave";

const BASESCAN_TX_URL = "https://basescan.org/tx";

type TxItem = {
  __typename?: string;
  timestamp?: string;
  txHash?: string;
};

type LendingTransactionHistoryProps = {
  marketAddressEvm: ReturnType<typeof evmAddress>;
  userEvm: ReturnType<typeof evmAddress>;
  walletAddress: string | null;
  chainId?: ChainId;
};

export function LendingTransactionHistory({
  marketAddressEvm,
  userEvm,
  walletAddress,
  chainId = AAVE_TARGET_CHAIN_ID,
}: LendingTransactionHistoryProps) {
  const [txCursor, setTxCursor] = useState<string | undefined>(undefined);
  const [accumulatedTxItems, setAccumulatedTxItems] = useState<TxItem[]>([]);
  const [txNextCursor, setTxNextCursor] = useState<string | undefined>(undefined);

  const { data: txHistory, loading: txHistoryLoading } = useUserTransactionHistory({
    market: marketAddressEvm,
    user: userEvm,
    chainId,
    orderBy: { date: OrderDirection.Desc },
    pageSize: PageSize.Fifty,
    ...(txCursor != null && { cursor: txCursor as never }),
  });

  useEffect(() => {
    if (txHistory?.items == null) return;
    const items = txHistory.items as TxItem[];
    if (txCursor == null) {
      setAccumulatedTxItems((prev) => (prev.length === 0 ? items : prev));
    } else {
      setAccumulatedTxItems((prev) => [...prev, ...items]);
    }
    setTxNextCursor(txHistory.pageInfo?.next ?? undefined);
    setTxCursor(undefined);
  }, [txHistory?.items, txHistory?.pageInfo?.next, txCursor]);

  const handleLoadMore = useCallback(() => {
    if (txNextCursor != null) setTxCursor(txNextCursor);
  }, [txNextCursor]);

  const displayItems =
    txCursor == null ? accumulatedTxItems : ((txHistory?.items ?? accumulatedTxItems) as TxItem[]);
  const showLoadMore = Boolean(txNextCursor && !txHistoryLoading);

  if (!walletAddress) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Transaction history</h2>
        <p className="text-sm text-slate-500">Connect a wallet to see your transaction history.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Transaction history</h2>
      {txHistoryLoading && accumulatedTxItems.length === 0 ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : displayItems.length > 0 ? (
        <>
          <ul
            className="max-h-48 list-none space-y-2 overflow-y-auto text-sm"
            aria-label="Aave lending transaction history"
          >
            {displayItems.map((item, i) => (
              <li
                key={item.txHash ?? i}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50/50 px-3 py-2"
              >
                <span className="text-slate-600">{item.__typename ?? "Transaction"}</span>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  {item.timestamp != null ? new Date(item.timestamp).toLocaleDateString() : "—"}
                  {item.txHash != null && (
                    <a
                      href={`${BASESCAN_TX_URL}/${item.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      aria-label={`View transaction ${item.txHash.slice(0, 10)} on Basescan`}
                    >
                      {item.txHash.slice(0, 10)}…
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {showLoadMore && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={txHistoryLoading}
              className="text-primary mt-2 text-xs font-medium hover:underline disabled:opacity-50"
            >
              Load more
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500">No transactions yet.</p>
      )}
    </section>
  );
}
