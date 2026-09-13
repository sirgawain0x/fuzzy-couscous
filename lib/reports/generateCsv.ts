import type { EarningsReport, ReportTransaction } from "./types";

/**
 * Generates a CSV string from an EarningsReport.
 * Format: Date,Type,Asset,Amount,Fee,Transaction Hash,Source,Description
 */
export function generateCsv(report: EarningsReport): string {
  const headers = [
    "Date",
    "Type",
    "Asset",
    "Amount",
    "Fee",
    "Transaction Hash",
    "Source",
    "Description",
  ];

  const rows = report.transactions.map((tx) => [
    formatDate(tx.date),
    tx.type,
    tx.asset,
    tx.amount,
    tx.fee || "",
    tx.txHash || "",
    tx.source,
    escapeCsv(tx.description || ""),
  ]);

  // Summary header
  const summaryRows = [
    [],
    ["Creative Finance — Earnings Report"],
    ["Wallet", report.walletAddress],
    ["Period", `${formatDate(report.period.from)} to ${formatDate(report.period.to)}`],
    ["Generated", formatDate(report.generatedAt)],
    [],
    ["Total Deposited", `$${report.summary.totalDeposited}`],
    ["Total Withdrawn", `$${report.summary.totalWithdrawn}`],
    ["Net Yield Earned", `$${report.summary.totalYieldEarned}`],
    ["Total Fees Paid", `$${report.summary.totalFeesPaid}`],
    ["Net Position", `$${report.summary.netPosition}`],
    [],
  ];

  const csvLines = [
    ...summaryRows.map((row) => row.join(",")),
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ];

  return csvLines.join("\n");
}

/**
 * Triggers a CSV file download in the browser.
 */
export function downloadCsv(report: EarningsReport): void {
  const csv = generateCsv(report);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `creative-finance-report-${formatDateShort(report.generatedAt)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toISOString().split("T")[0];
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
