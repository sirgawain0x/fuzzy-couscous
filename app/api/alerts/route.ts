import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/cockroachdb";
import { requireAuthedWallet, assertWalletMatches } from "@/lib/apiAuth";

/**
 * GET /api/alerts
 * Returns unacknowledged health alerts for the authenticated user's wallet.
 * The session's wallet is the source of truth — any `wallet` query param must
 * match it or the request is rejected.
 *
 * PATCH /api/alerts
 * Acknowledges an alert by ID, scoped to the session user's wallet.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthedWallet(request);
  if (!auth.ok) return auth.response;

  const claimed = request.nextUrl.searchParams.get("wallet");
  const mismatch = assertWalletMatches(auth.session.walletAddress, claimed);
  if (mismatch) return mismatch;

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, alert_type, previous_status, current_status,
              health_factor, message, created_at
       FROM health_alerts
       WHERE wallet_address = $1 AND acknowledged = false
       ORDER BY created_at DESC
       LIMIT 10`,
      [auth.session.walletAddress]
    );

    return NextResponse.json({ alerts: rows });
  } catch (err: any) {
    console.error("[Alerts API] Error:", err.message);
    return NextResponse.json({ alerts: [] });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, sessionToken } = body ?? {};

    if (!alertId) {
      return NextResponse.json({ error: "alertId is required" }, { status: 400 });
    }

    const auth = await requireAuthedWallet(request, sessionToken);
    if (!auth.ok) return auth.response;

    const pool = getPool();
    const result = await pool.query(
      `UPDATE health_alerts
       SET acknowledged = true, acknowledged_at = now()
       WHERE id = $1 AND wallet_address = $2`,
      [alertId, auth.session.walletAddress]
    );

    if (!result.rowCount) {
      return NextResponse.json(
        { error: "Alert not found or not owned by this wallet" },
        { status: 404 }
      );
    }

    return NextResponse.json({ acknowledged: true });
  } catch (err: any) {
    console.error("[Alerts API] Error:", err.message);
    return NextResponse.json({ error: "Failed to acknowledge alert" }, { status: 500 });
  }
}
