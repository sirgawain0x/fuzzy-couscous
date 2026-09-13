"use client";

import type { Reserve } from "@aave/react";

interface IsolationModeWarningProps {
  isInIsolationMode: boolean;
  isolatedReserve?: Reserve;
}

/**
 * Warning banner when user's position is in Isolation Mode.
 * Isolation Mode restricts which assets can be borrowed and enforces a debt ceiling.
 */
export function IsolationModeWarning({
  isInIsolationMode,
  isolatedReserve,
}: IsolationModeWarningProps) {
  if (!isInIsolationMode) return null;

  const config = isolatedReserve?.isolationModeConfig;
  const debtCeiling = config?.debtCeiling;
  const totalBorrows = config?.totalBorrows;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚠️</span>
        <h4 className="text-sm font-semibold text-amber-900">Isolation Mode Active</h4>
      </div>

      <p className="text-xs text-amber-800">
        Your position includes an isolated collateral asset
        {isolatedReserve ? ` (${isolatedReserve.underlyingToken?.symbol})` : ""}. This limits which
        assets you can borrow and enforces a debt ceiling.
      </p>

      {debtCeiling && totalBorrows && (
        <div className="flex gap-4 text-xs text-amber-700">
          <span>
            Debt ceiling: <strong>${Number(debtCeiling.usd ?? 0).toLocaleString()}</strong>
          </span>
          <span>
            Current debt: <strong>${Number(totalBorrows.usd ?? 0).toLocaleString()}</strong>
          </span>
        </div>
      )}

      <ul className="list-inside list-disc text-xs text-amber-700">
        <li>Only stablecoins can be borrowed in Isolation Mode</li>
        <li>Other supplied assets cannot be used as collateral</li>
        <li>To exit, repay all debt and disable the isolated asset as collateral</li>
      </ul>
    </div>
  );
}
