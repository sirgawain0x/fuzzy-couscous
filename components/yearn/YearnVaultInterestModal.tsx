"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Address, formatUnits } from "viem";
import { usePublicClient } from "wagmi";

import { Modal } from "@/components/common/Modal";
import { useYearnVaultBalance } from "@/hooks/useYearnVaults";
import { useYearnVaultCashflows } from "@/hooks/useYearnVaultCashflows";
import { BASE_BLOCK_EXPLORER_ADDRESS_URL, YEARN_CHAIN_ID } from "@/lib/config/yearn";

const formatMoneyEarnedDisplay = (wei: bigint, decimals: number): string => {
  if (wei === 0n) return "0";
  const n = Number(formatUnits(wei, decimals));
  if (!Number.isFinite(n)) return formatUnits(wei, decimals);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 10,
  });
};

type YearnInterestSnapshot = {
  timestamp: number;
  blockNumber: bigint;
  positionValueWei: bigint;
  netProfitWei: bigint | null;
};

type PersistedSession = {
  snapshots: Array<{
    timestamp: number;
    blockNumber: string;
    positionValueWei: string;
    netProfitWei: string | null;
  }>;
};

type YearnVaultInterestModalProps = {
  open: boolean;
  onClose: () => void;
  vaultAddress: Address;
  userAddress: Address | undefined;
  assetSymbol?: string;
  assetDecimals?: number;
};

const SNAPSHOT_INTERVAL_MS = 60_000; // ~1 minute
const MAX_SNAPSHOTS = 200;

export function YearnVaultInterestModal({
  open,
  onClose,
  vaultAddress,
  userAddress,
  assetSymbol = "USDC",
  assetDecimals = 6,
}: YearnVaultInterestModalProps) {
  const publicClient = usePublicClient({ chainId: YEARN_CHAIN_ID });
  const {
    shareBalance,
    assetValue,
    refetch: refetchBalance,
  } = useYearnVaultBalance(vaultAddress, userAddress);

  const [snapshots, setSnapshots] = useState<YearnInterestSnapshot[]>([]);
  const [cashflowMessage, setCashflowMessage] = useState<string | null>(null);

  const storageKey = useMemo(() => {
    if (!userAddress) return undefined;
    return `yearnInterest:${vaultAddress.toLowerCase()}:${userAddress.toLowerCase()}`;
  }, [userAddress, vaultAddress]);

  const {
    points: cashflowPoints,
    isLoading: cashflowsLoading,
    error: cashflowsError,
    refetch: refetchCashflows,
    getNetDepositsWeiAtBlock,
  } = useYearnVaultCashflows(vaultAddress, userAddress, undefined);

  const [isRefreshingCashflows, setIsRefreshingCashflows] = useState(false);

  // Load persisted session when the modal opens.
  useEffect(() => {
    if (!open) return;
    if (!userAddress || !storageKey) return;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setSnapshots([]);
        setCashflowMessage(null);
        return;
      }

      const parsed = JSON.parse(raw) as PersistedSession;
      setSnapshots(
        (parsed.snapshots ?? []).map((s) => ({
          timestamp: s.timestamp,
          blockNumber: BigInt(s.blockNumber),
          positionValueWei: BigInt(s.positionValueWei),
          netProfitWei: s.netProfitWei != null ? BigInt(s.netProfitWei) : null,
        }))
      );
      setCashflowMessage(null);
    } catch (e) {
      // If parsing fails, fall back to fresh tracking.
      setSnapshots([]);
      setCashflowMessage("Unable to load saved interest history. Starting a new session.");
    }
  }, [open, userAddress, storageKey]);

  const persistSession = useCallback(
    (session: PersistedSession) => {
      if (!storageKey) return;
      localStorage.setItem(storageKey, JSON.stringify(session));
    },
    [storageKey]
  );

  const handleClearHistory = useCallback(() => {
    if (!storageKey) return;
    localStorage.removeItem(storageKey);
    setSnapshots([]);
    setCashflowMessage(null);
  }, [storageKey]);

  const handleRefreshCashflows = useCallback(async () => {
    if (!userAddress) return;
    if (isRefreshingCashflows) return;

    setIsRefreshingCashflows(true);
    setCashflowMessage(null);

    try {
      await refetchCashflows();
      setCashflowMessage("Cashflow history refreshed.");
    } catch {
      setCashflowMessage("Failed to refresh cashflow history. Please try again.");
    } finally {
      setIsRefreshingCashflows(false);
    }
  }, [userAddress, isRefreshingCashflows, refetchCashflows]);

  // When cashflow history changes, recompute stored net profit at each snapshot block.
  useEffect(() => {
    if (!open) return;
    if (!cashflowPoints.length) return;
    if (!snapshots.length) return;

    setSnapshots((prev) =>
      prev.map((s) => ({
        ...s,
        netProfitWei: s.positionValueWei - getNetDepositsWeiAtBlock(s.blockNumber),
      }))
    );
  }, [open, cashflowPoints.length, snapshots.length, getNetDepositsWeiAtBlock]);

  const sampleOnce = useCallback(async () => {
    if (!open) return;
    if (!userAddress) return;
    if (!publicClient) return;
    if (shareBalance == null || shareBalance <= 0n) return;
    if (assetValue == null) return;
    if (cashflowsLoading) return;
    if (cashflowPoints.length === 0) {
      const msg = cashflowsError
        ? `Cashflow history failed to load: ${cashflowsError.message}`
        : cashflowsLoading
          ? "Loading your deposit and withdraw history…"
          : "No deposit/withdraw history found for this wallet on this vault. If you already deposited, set NEXT_PUBLIC_YEARN_CASHFLOW_RPC_FROM_BLOCK to an earlier Base block (env) and tap Refresh.";
      setCashflowMessage(msg);
    } else {
      setCashflowMessage(null);
    }

    try {
      const currentBlockNumber = await publicClient.getBlockNumber();
      const refetchRes = await refetchBalance();
      const latestPositionValueWei = refetchRes.assetValue ?? assetValue;
      if (latestPositionValueWei == null) return;

      const netProfitWei =
        cashflowPoints.length === 0
          ? 0n
          : latestPositionValueWei - getNetDepositsWeiAtBlock(currentBlockNumber);

      if (cashflowPoints.length > 0) {
        setCashflowMessage(null);
      }

      setSnapshots((prev) => {
        const last = prev[prev.length - 1];
        const nextSnapshot: YearnInterestSnapshot = {
          timestamp: Date.now(),
          blockNumber: currentBlockNumber,
          positionValueWei: latestPositionValueWei,
          netProfitWei,
        };

        const next =
          last && last.blockNumber === currentBlockNumber
            ? [...prev.slice(0, -1), nextSnapshot]
            : [...prev, nextSnapshot];
        const capped = next.length > MAX_SNAPSHOTS ? next.slice(next.length - MAX_SNAPSHOTS) : next;

        // Persist (best effort)
        if (storageKey) {
          persistSession({
            snapshots: capped.map((s) => ({
              timestamp: s.timestamp,
              blockNumber: s.blockNumber.toString(),
              positionValueWei: s.positionValueWei.toString(),
              netProfitWei: s.netProfitWei == null ? null : s.netProfitWei.toString(),
            })),
          });
        }

        return capped;
      });
    } catch {
      setCashflowMessage("Unable to sample position value at this time. Please try again shortly.");
    }
  }, [
    open,
    userAddress,
    publicClient,
    refetchBalance,
    shareBalance,
    assetValue,
    cashflowsLoading,
    cashflowPoints.length,
    cashflowsError,
    getNetDepositsWeiAtBlock,
    storageKey,
    persistSession,
  ]);

  // Sampling loop while the modal is open.
  useEffect(() => {
    if (!open) return;
    if (!userAddress) return;
    if (shareBalance == null || shareBalance <= 0n) return;

    const interval = window.setInterval(() => {
      void sampleOnce();
    }, SNAPSHOT_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [open, userAddress, shareBalance, sampleOnce]);

  const latest = snapshots[snapshots.length - 1];

  const latestNetProfitDisplay =
    latest?.netProfitWei == null
      ? "—"
      : formatMoneyEarnedDisplay(latest.netProfitWei, assetDecimals);
  const latestPositionValueDisplay =
    latest?.positionValueWei == null
      ? "—"
      : formatMoneyEarnedDisplay(latest.positionValueWei, assetDecimals);

  const netDepositsTrackedWei = useMemo(() => {
    if (!cashflowPoints.length || latest?.blockNumber == null) return null;
    return getNetDepositsWeiAtBlock(latest.blockNumber);
  }, [cashflowPoints.length, latest?.blockNumber, getNetDepositsWeiAtBlock]);

  const netDepositsTrackedDisplay =
    netDepositsTrackedWei == null
      ? null
      : formatMoneyEarnedDisplay(netDepositsTrackedWei, assetDecimals);

  const profitPointsForChart = snapshots
    .slice(-100)
    .filter((s): s is YearnInterestSnapshot & { netProfitWei: bigint } => s.netProfitWei != null);

  const chart = useMemo(() => {
    const vals = profitPointsForChart.map((s) =>
      Number(formatUnits(s.netProfitWei, assetDecimals))
    );
    if (vals.length < 2) return null;

    const chartWidth = 600;
    const chartHeight = 200;
    const padding = 28;

    const minVal = Math.min(0, ...vals);
    const maxVal = Math.max(0, ...vals);
    const range = maxVal - minVal;
    const safeRange = range === 0 ? 1 : range;

    const toX = (i: number) =>
      padding + (vals.length === 1 ? 0 : (i / (vals.length - 1)) * (chartWidth - padding * 2));
    const toY = (v: number) =>
      padding + (1 - (v - minVal) / safeRange) * (chartHeight - padding * 2);

    const polyPoints = vals.map((v, i) => `${toX(i).toFixed(2)},${toY(v).toFixed(2)}`).join(" ");

    return { chartWidth, chartHeight, polyPoints, minVal, maxVal };
  }, [profitPointsForChart, assetDecimals]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Interest Earned"
      showCloseButton
      className="max-w-2xl bg-white text-slate-900"
    >
      <div className="mt-6 flex w-full flex-col gap-5 text-sm">
        {!userAddress ? (
          <p className="text-sm text-slate-600">
            Connect a wallet to see your Yearn V3 interest earned history.
          </p>
        ) : cashflowsLoading && snapshots.length === 0 ? (
          <div className="flex animate-pulse flex-col gap-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="h-3 w-32 rounded bg-slate-200" />
                <div className="mt-3 h-8 w-40 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-48 rounded bg-slate-200" />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="h-3 w-32 rounded bg-slate-200" />
                <div className="mt-3 h-8 w-40 rounded bg-slate-200" />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="h-4 w-36 rounded bg-slate-200" />
              <div className="mt-4 h-[180px] w-full rounded bg-slate-100" />
            </div>
            <p className="text-center text-xs text-slate-500">Loading interest data...</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Interest Earned (Total Growth)
                </h4>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {latestNetProfitDisplay} {assetSymbol}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Total interest earned including realized and unrealized gains.
                </p>
                {netDepositsTrackedDisplay != null ? (
                  <p className="mt-2 text-xs text-slate-600">
                    Net deposits tracked: {netDepositsTrackedDisplay} {assetSymbol}
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Current position value
                </h4>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {latestPositionValueDisplay} {assetSymbol}
                </p>
                {/* Keep this card copy short: the modal title and numbers already explain the source. */}
              </div>
            </section>

            {cashflowMessage ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {cashflowMessage}
              </p>
            ) : null}

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-base font-semibold text-slate-900">Interest earned trend</h4>
                <p className="text-xs text-slate-500">Sampled ~every minute</p>
              </div>

              <div className="mt-4">
                {chart ? (
                  <svg
                    width="100%"
                    viewBox={`0 0 ${chart.chartWidth} ${chart.chartHeight}`}
                    role="img"
                    aria-label="Interest earned over time chart"
                    className="h-[220px] w-full"
                  >
                    <polyline
                      fill="none"
                      stroke="#0f766e"
                      strokeWidth="3"
                      points={chart.polyPoints}
                    />
                    <line x1="28" y1={200 - 28} x2={600 - 28} y2={200 - 28} stroke="#e2e8f0" />
                  </svg>
                ) : (
                  <p className="text-sm text-slate-500">
                    Not enough samples yet. Start earning interest to see a trend.
                  </p>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleRefreshCashflows()}
                  disabled={!userAddress || isRefreshingCashflows || cashflowsLoading}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Refresh cashflow history"
                  tabIndex={0}
                >
                  {isRefreshingCashflows ? "Refreshing…" : "Refresh cashflow history"}
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-base font-semibold text-slate-900">Latest snapshots</h4>
                <p className="text-xs text-slate-500">
                  {snapshots.length ? `${snapshots.length} stored` : "No samples yet"}
                </p>
              </div>

              <div className="mt-3 max-h-[240px] overflow-y-auto">
                {snapshots.length ? (
                  <ul className="space-y-2">
                    {[...snapshots]
                      .slice(-10)
                      .reverse()
                      .map((s, idx) => (
                        <li
                          key={`${s.blockNumber.toString()}-${s.timestamp}-${idx}`}
                          className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-slate-600">
                              {new Date(s.timestamp).toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500">
                              Block {s.blockNumber.toString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-slate-600">Interest earned</span>
                            <span className="text-sm font-semibold text-slate-900">
                              {s.netProfitWei == null
                                ? "—"
                                : `${formatMoneyEarnedDisplay(s.netProfitWei, assetDecimals)} ${assetSymbol}`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-slate-600">Position value</span>
                            <span className="text-sm font-semibold text-slate-900">
                              {`${formatMoneyEarnedDisplay(s.positionValueWei, assetDecimals)} ${assetSymbol}`}
                            </span>
                          </div>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Sampling your history…</p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                  aria-label="Clear tracking history"
                  tabIndex={0}
                >
                  Clear tracking history
                </button>
              </div>
            </section>

            <p className="text-center text-xs text-slate-500">
              <Link
                href={`${BASE_BLOCK_EXPLORER_ADDRESS_URL}/${vaultAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-slate-800"
              >
                View vault on Basescan
              </Link>
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
