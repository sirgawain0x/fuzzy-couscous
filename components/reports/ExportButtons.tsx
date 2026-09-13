"use client";

import type { EarningsReport } from "@/lib/reports/types";
import { downloadCsv } from "@/lib/reports/generateCsv";
import { downloadPdf } from "@/lib/reports/generatePdf";

interface ExportButtonsProps {
  report: EarningsReport;
}

export function ExportButtons({ report }: ExportButtonsProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => downloadCsv(report)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <span>📄</span> Export CSV
      </button>
      <button
        onClick={() => downloadPdf(report)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <span>📋</span> Export PDF
      </button>
    </div>
  );
}
