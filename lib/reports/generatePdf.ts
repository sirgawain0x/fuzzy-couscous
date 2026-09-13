import type { EarningsReport } from "./types";

/**
 * Opens a print-optimized window for PDF export.
 * Uses the browser's native print-to-PDF functionality
 * for a clean, professional layout without extra dependencies.
 */
export function downloadPdf(report: EarningsReport): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to download the PDF report.");
    return;
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const transactionRows = report.transactions
    .map(
      (tx) => `
      <tr>
        <td>${formatDate(tx.date)}</td>
        <td>${tx.type.replace("_", " ")}</td>
        <td>${tx.asset}</td>
        <td>$${tx.amount}</td>
        <td>${tx.fee ? `$${tx.fee}` : "—"}</td>
        <td>${tx.source}</td>
      </tr>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Creative Finance — Earnings Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 40px; font-size: 12px; }
        .header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 20px; font-weight: 700; }
        .header p { font-size: 11px; color: #64748b; margin-top: 4px; }
        .meta { display: flex; gap: 32px; margin-bottom: 24px; font-size: 11px; color: #475569; }
        .meta span { display: block; }
        .meta strong { color: #0f172a; }
        .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 32px; }
        .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
        .summary-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px; }
        .summary-card .value { font-size: 18px; font-weight: 700; }
        .summary-card .value.positive { color: #059669; }
        .summary-card .value.negative { color: #dc2626; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
        td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
        @media print { body { padding: 20px; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Creative Finance — Earnings Report</h1>
        <p>For informational purposes only. Consult a tax professional for filing guidance.</p>
      </div>

      <div class="meta">
        <div><span>Wallet</span><strong>${report.walletAddress}</strong></div>
        <div><span>Period</span><strong>${formatDate(report.period.from)} — ${formatDate(report.period.to)}</strong></div>
        <div><span>Generated</span><strong>${formatDate(report.generatedAt)}</strong></div>
      </div>

      <div class="summary">
        <div class="summary-card">
          <div class="label">Total Deposited</div>
          <div class="value">$${report.summary.totalDeposited}</div>
        </div>
        <div class="summary-card">
          <div class="label">Total Withdrawn</div>
          <div class="value">$${report.summary.totalWithdrawn}</div>
        </div>
        <div class="summary-card">
          <div class="label">Net Yield</div>
          <div class="value positive">$${report.summary.totalYieldEarned}</div>
        </div>
        <div class="summary-card">
          <div class="label">Fees Paid</div>
          <div class="value negative">$${report.summary.totalFeesPaid}</div>
        </div>
        <div class="summary-card">
          <div class="label">Net Position</div>
          <div class="value">$${report.summary.netPosition}</div>
        </div>
      </div>

      <h2 style="font-size: 14px; margin-bottom: 12px;">Transaction History (${report.transactions.length} entries)</h2>
      <table>
        <thead>
          <tr><th>Date</th><th>Type</th><th>Asset</th><th>Amount</th><th>Fee</th><th>Source</th></tr>
        </thead>
        <tbody>
          ${transactionRows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">No transactions found</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        Creative Finance by Creative Organization DAO — Generated on ${formatDate(report.generatedAt)}
      </div>

      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
