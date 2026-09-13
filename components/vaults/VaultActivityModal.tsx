"use client";

import { useMemo } from "react";
import { Address, formatUnits } from "viem";
import {
  evmAddress,
  chainId as aaveChainId,
  PageSize,
  OrderDirection,
  VaultUserActivityTimeWindow,
  useVaultUserTransactionHistory,
  useVaultUserActivity,
} from "@aave/react";

import { Modal } from "@/components/common/Modal";

type HistoryItem = {
  __typename?: string;
  txHash?: string;
  timestamp?: string;
  asset?: { amount?: { value?: string }; usd?: string };
  shares?: { amount?: { value?: string } };
};

type VaultActivityModalProps = {
  open: boolean;
  onClose: () => void;
  vaultAddress: Address;
  chainId: number;
  userAddress: Address | undefined;
  assetSymbol?: string;
  /** Current asset value of user's vault shares (from convertToAssets(balanceOf(user))). */
  currentAssetValueWei?: bigint;
  /** Token decimals (e.g. 6 for USDC). */
  assetDecimals?: number;
};

export function VaultActivityModal({
  open,
  onClose,
  vaultAddress,
  chainId,
  userAddress,
  assetSymbol = "USDC",
  currentAssetValueWei,
  assetDecimals = 6,
}: VaultActivityModalProps) {
  const chainIdTag = useMemo(() => aaveChainId(chainId), [chainId]);

  const { data: historyData, loading: historyLoading } = useVaultUserTransactionHistory(
    open && userAddress
      ? {
          vault: evmAddress(vaultAddress),
          chainId: chainIdTag,
          user: evmAddress(userAddress),
          orderBy: { date: OrderDirection.Desc },
          pageSize: PageSize.Fifty,
        }
      : ({} as Parameters<typeof useVaultUserTransactionHistory>[0])
  );

  const { data: activityData, loading: activityLoading } = useVaultUserActivity(
    open && userAddress
      ? {
          vault: evmAddress(vaultAddress),
          chainId: chainIdTag,
          user: evmAddress(userAddress),
          window: VaultUserActivityTimeWindow.LastWeek,
        }
      : ({} as Parameters<typeof useVaultUserActivity>[0])
  );

  const items = (historyData?.items ?? []) as HistoryItem[];
  const breakdown = activityData?.breakdown ?? [];

  const currentPositionFormatted = useMemo(() => {
    if (currentAssetValueWei == null || currentAssetValueWei === 0n || assetDecimals == null)
      return null;
    return parseFloat(formatUnits(currentAssetValueWei, assetDecimals));
  }, [currentAssetValueWei, assetDecimals]);

  const positionChart = useMemo(() => {
    const vals = breakdown
      .map((row) => parseFloat(row.balance?.amount?.value ?? "0"))
      .filter((v) => Number.isFinite(v));
    if (vals.length < 2) return null;

    const chartWidth = 600;
    const chartHeight = 180;
    const padding = 28;

    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const range = maxVal - minVal;
    const safeRange = range === 0 ? 1 : range;

    const toX = (i: number) => padding + (i / (vals.length - 1)) * (chartWidth - padding * 2);
    const toY = (v: number) =>
      padding + (1 - (v - minVal) / safeRange) * (chartHeight - padding * 2);

    const linePoints = vals.map((v, i) => `${toX(i).toFixed(2)},${toY(v).toFixed(2)}`).join(" ");

    // Closed polygon for the gradient fill area
    const firstX = toX(0).toFixed(2);
    const lastX = toX(vals.length - 1).toFixed(2);
    const bottomY = (chartHeight - padding).toFixed(2);
    const fillPoints = `${firstX},${bottomY} ${linePoints} ${lastX},${bottomY}`;

    return { chartWidth, chartHeight, linePoints, fillPoints, padding };
  }, [breakdown]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vault activity"
      showCloseButton
      className="max-w-2xl bg-white text-slate-900"
    >
      <div className="mt-6 flex w-full flex-col gap-5 text-sm text-slate-700">
        {activityLoading ? (
          <p className="text-sm text-slate-500">Loading activity…</p>
        ) : (
          <>
            {currentPositionFormatted != null && (
              <section className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h4 className="text-base font-semibold text-slate-900">Your position</h4>
                <p className="text-lg font-semibold text-slate-900">
                  {currentPositionFormatted.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}{" "}
                  {assetSymbol}
                </p>
                <p className="text-xs text-slate-500">
                  Your vault balance is earning interest. Detailed earnings data will appear once
                  activity is indexed.
                </p>
              </section>
            )}

            {positionChart && (
              <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-base font-semibold text-slate-900">Position over time</h4>
                <svg
                  width="100%"
                  viewBox={`0 0 ${positionChart.chartWidth} ${positionChart.chartHeight}`}
                  role="img"
                  aria-label="Position value over time"
                  className="h-[200px] w-full"
                >
                  <defs>
                    <linearGradient id="positionFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f766e" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <polygon fill="url(#positionFill)" points={positionChart.fillPoints} />
                  <polyline
                    fill="none"
                    stroke="#0f766e"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={positionChart.linePoints}
                  />
                  <line
                    x1={positionChart.padding}
                    y1={positionChart.chartHeight - positionChart.padding}
                    x2={positionChart.chartWidth - positionChart.padding}
                    y2={positionChart.chartHeight - positionChart.padding}
                    stroke="#e2e8f0"
                  />
                </svg>
              </section>
            )}

            {breakdown.length > 0 && (
              <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-base font-semibold text-slate-900">Activity breakdown</h4>
                <div className="max-h-[min(12rem,40vh)] overflow-y-auto">
                  <ul className="space-y-2">
                    {breakdown.map((row, i) => (
                      <li
                        key={String(row.date ?? i)}
                        className="flex justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                      >
                        <span className="text-slate-600">{String(row.date ?? "—")}</span>
                        <span className="text-slate-900">
                          Balance: {row.balance?.amount?.value ?? "0"} · Earned:{" "}
                          {row.earned?.amount?.value ?? "0"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-base font-semibold text-slate-900">Recent transactions</h4>
              {historyLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-slate-500">No transactions yet.</p>
              ) : (
                <div className="max-h-[min(14rem,40vh)] overflow-y-auto">
                  <ul className="space-y-2" aria-label="Vault transaction history">
                    {items.map((item, i) => (
                      <li
                        key={item.txHash ?? i}
                        className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-slate-700">
                          {item.__typename === "VaultUserDepositItem" ? "Deposit" : "Withdraw"}
                        </span>
                        {item.asset?.amount?.value != null && (
                          <span className="text-slate-600">
                            {item.asset.amount.value} {assetSymbol}
                            {item.asset.usd != null && ` ($${item.asset.usd})`}
                          </span>
                        )}
                        {item.txHash && (
                          <a
                            href={`https://basescan.org/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-slate-500 underline"
                          >
                            {item.txHash.slice(0, 10)}…
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
