import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/cockroachdb";
import { batchGetUserAccountData } from "@/lib/aavePool";
import { processHealthCheck } from "@/lib/healthMonitor";

/**
 * GET /api/cron/health-monitor
 * Safety-net cron (hourly fallback via Vercel Cron).
 * Checks all users with active borrows and updates health factor snapshots.
 * Catches anything the price-triggered Goldsky webhooks may have missed.
 */
export async function GET(request: NextRequest) {
  // Vercel Cron authentication
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.COCKROACHDB_URL) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const pool = getPool();

    const { rows: users } = await pool.query(
      `SELECT wallet_address FROM users WHERE wallet_address IS NOT NULL`
    );

    if (users.length === 0) {
      return NextResponse.json({ checked: 0, message: "No users to monitor" });
    }

    const addresses = users.map((u: any) => u.wallet_address);
    const accountData = await batchGetUserAccountData(addresses);

    const { snapshotsCreated, alertsCreated } = await processHealthCheck(pool, accountData, "cron");

    return NextResponse.json({
      checked: accountData.length,
      withBorrows: snapshotsCreated,
      alertsCreated,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Health Monitor Cron] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
