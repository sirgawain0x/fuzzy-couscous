"use client";

interface FeeBreakdownProps {
  performanceFee: number;
  hasMembership: boolean;
}

/**
 * Displays the fee distribution breakdown for vault deployment.
 *
 * Formula: For a set fee F:
 *   Aave Share  = F × 0.50        (50% — protocol-level, automatic)
 *   Yearn Share = F × 0.50 × 0.10 (10% of manager's half)
 *   Net Manager = F × 0.50 × 0.90 (90% of manager's half)
 */
export function FeeBreakdown({ performanceFee, hasMembership }: FeeBreakdownProps) {
  const fee = performanceFee / 100;
  const aavePercent = fee * 0.5;
  const managerGross = fee * 0.5;
  const yearnPercent = managerGross * 0.1;
  const netManager = managerGross * 0.9;

  const formatPct = (n: number) => `${(n * 100).toFixed(1)}%`;

  // Example on $10,000 profit
  const exampleProfit = 10000;
  const totalFee = exampleProfit * fee;
  const aaveDollars = exampleProfit * aavePercent;
  const yearnDollars = exampleProfit * yearnPercent;
  const managerDollars = exampleProfit * netManager;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold text-slate-600 uppercase">Fee Breakdown</h5>
        <span className="text-xs text-slate-400">on ${exampleProfit.toLocaleString()} profit</span>
      </div>

      <div className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <span
            className="text-slate-500"
            title="Aave takes 50% of performance fees to maintain the lending market's security and liquidity."
          >
            Aave Labs (50% of fee)
          </span>
          <span className="font-medium text-slate-700">
            {formatPct(aavePercent)} &middot; ${aaveDollars.toFixed(0)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Yearn V3 (10% of manager)</span>
          <span className="font-medium text-slate-700">
            {formatPct(yearnPercent)} &middot; ${yearnDollars.toFixed(0)}
          </span>
        </div>

        <div className="border-t border-slate-100 pt-1">
          <div className="flex justify-between">
            <span className="font-medium text-slate-700">
              {hasMembership ? "Net to You" : "Net to Treasury"}
            </span>
            <span className="font-semibold text-emerald-700">
              {formatPct(netManager)} &middot; ${managerDollars.toFixed(0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
