"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/context/AuthContext";
import type { EarningsReport as EarningsReportType } from "@/lib/reports/types";
import { TransactionTable } from "./TransactionTable";
import { ExportButtons } from "./ExportButtons";
import { LiquidationHistory } from "./LiquidationHistory";
import { Modal } from "@/components/common/Modal";
import { PrimaryButton } from "@/components/common/PrimaryButton";

interface EarningsReportProps {
  open: boolean;
  onClose: () => void;
}

export function EarningsReport({ open, onClose }: EarningsReportProps) {
  const { wallet } = useWallet();
  const { sessionToken } = useAuth();
  const [report, setReport] = useState<EarningsReportType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to current year
  const currentYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);

  const generateReport = useCallback(async () => {
    if (!wallet?.address) {
      setError("Wallet not connected");
      return;
    }
    if (!sessionToken) {
      setError("Please sign in to generate a report");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          walletAddress: wallet.address,
          from: new Date(fromDate).toISOString(),
          to: new Date(toDate + "T23:59:59").toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate report");
      }

      const data = await response.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate report");
    } finally {
      setIsLoading(false);
    }
  }, [wallet?.address, sessionToken, fromDate, toDate]);

  const handleClose = () => {
    setReport(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      showCloseButton
      showBackButton={!!report}
      onBack={() => setReport(null)}
      title="Earnings Report"
      className="max-w-3xl"
    >
      {!report ? (
        // Report configuration
        <div className="flex flex-col gap-6">
          <p className="text-center text-sm text-slate-600">
            Generate a financial report for tax filing and accounting. Includes all deposits,
            withdrawals, vault activity, and yield earned.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 uppercase">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 uppercase">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </label>
          </div>

          {error && <p className="text-center text-sm text-red-600">{error}</p>}

          <PrimaryButton onClick={generateReport} disabled={isLoading}>
            {isLoading ? "Generating..." : "Generate Report"}
          </PrimaryButton>

          <p className="text-center text-xs text-slate-400">
            For informational purposes only. Consult a tax professional for filing guidance.
          </p>
        </div>
      ) : (
        // Report results
        <div className="flex flex-col gap-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <SummaryCard label="Total Deposited" value={`$${report.summary.totalDeposited}`} />
            <SummaryCard label="Total Withdrawn" value={`$${report.summary.totalWithdrawn}`} />
            <SummaryCard label="Net Yield" value={`$${report.summary.totalYieldEarned}`} positive />
            <SummaryCard label="Fees Paid" value={`$${report.summary.totalFeesPaid}`} negative />
            <SummaryCard label="Net Position" value={`$${report.summary.netPosition}`} />
          </div>

          {/* Export buttons */}
          <ExportButtons report={report} />

          {/* Liquidation history */}
          <LiquidationHistory />

          {/* Transaction table */}
          <TransactionTable transactions={report.transactions} />
        </div>
      )}
    </Modal>
  );
}

function SummaryCard({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-3">
      <span className="text-xs font-medium text-slate-500 uppercase">{label}</span>
      <span
        className={`mt-1 text-lg font-bold ${
          positive ? "text-emerald-700" : negative ? "text-red-600" : "text-slate-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
