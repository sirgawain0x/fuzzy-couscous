"use client";

import { useState, useMemo } from "react";
import type { ReportTransaction, TransactionType } from "@/lib/reports/types";

interface TransactionTableProps {
  transactions: ReportTransaction[];
}

const TYPE_LABELS: Record<TransactionType, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  send: "Send",
  receive: "Receive",
  vault_deposit: "Vault Deposit",
  vault_withdrawal: "Vault Withdrawal",
  yield: "Yield",
  supply: "Supply",
  borrow: "Borrow",
  repay: "Repay",
};

const TYPE_COLORS: Record<TransactionType, string> = {
  deposit: "bg-green-100 text-green-800",
  withdrawal: "bg-red-100 text-red-800",
  send: "bg-blue-100 text-blue-800",
  receive: "bg-green-100 text-green-800",
  vault_deposit: "bg-indigo-100 text-indigo-800",
  vault_withdrawal: "bg-orange-100 text-orange-800",
  yield: "bg-emerald-100 text-emerald-800",
  supply: "bg-cyan-100 text-cyan-800",
  borrow: "bg-amber-100 text-amber-800",
  repay: "bg-teal-100 text-teal-800",
};

export function TransactionTable({ transactions }: TransactionTableProps) {
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let result = transactions;
    if (typeFilter !== "all") {
      result = result.filter((tx) => tx.type === typeFilter);
    }
    return result.sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortDir === "asc" ? diff : -diff;
    });
  }, [transactions, typeFilter, sortDir]);

  const uniqueTypes = useMemo(
    () => [...new Set(transactions.map((tx) => tx.type))],
    [transactions]
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const shortenHash = (hash: string) => `${hash.slice(0, 6)}...${hash.slice(-4)}`;

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TransactionType | "all")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="all">All types</option>
          {uniqueTypes.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          {sortDir === "desc" ? "Newest first" : "Oldest first"}
        </button>
        <span className="text-xs text-slate-500">
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">
                Date
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">
                Type
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">
                Asset
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">
                Amount
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">
                Fee
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">
                Source
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">
                Tx
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No transactions found
                </td>
              </tr>
            ) : (
              filtered.map((tx, i) => (
                <tr
                  key={`${tx.txHash || i}-${tx.date}`}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-2.5 text-slate-700">{formatDate(tx.date)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[tx.type]}`}
                    >
                      {TYPE_LABELS[tx.type]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{tx.asset}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                    ${Number(tx.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">
                    {tx.fee ? `$${Number(tx.fee).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 capitalize">{tx.source}</td>
                  <td className="px-4 py-2.5">
                    {tx.txHash ? (
                      <a
                        href={`https://basescan.org/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {shortenHash(tx.txHash)}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
