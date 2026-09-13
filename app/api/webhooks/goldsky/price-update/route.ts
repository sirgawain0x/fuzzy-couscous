import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getPool } from "@/lib/cockroachdb";
import { batchGetUserAccountData } from "@/lib/aavePool";
import { processHealthCheck } from "@/lib/healthMonitor";

/**
 * POST /api/webhooks/goldsky/price-update
 * Goldsky price-triggered webhook. On significant price movements,
 * checks at-risk users and creates health factor alerts.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  // Verify Goldsky signature
  const signature = request.headers.get("x-goldsky-signature");
  const secret = process.env.GOLDSKY_WEBHOOK_SECRET;

  if (secret && signature) {
    const computed = createHmac("sha256", secret).update(body).digest("hex");
    try {
      if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(computed, "hex"))) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  try {
    const payload = JSON.parse(body);
    const asset = payload.asset || payload.symbol || payload.token;

    if (!process.env.COCKROACHDB_URL) {
      return NextResponse.json({ received: true, skipped: "no database" });
    }

    const pool = getPool();

    // Log the webhook event
    const eventId = payload.id || `price-${asset}-${Date.now()}`;
    await pool.query(
      `INSERT INTO webhook_events (event_type, event_id, source, payload, status)
       VALUES ('price_update', $1, 'goldsky', $2, 'received')
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, JSON.stringify(payload)]
    );

    // Find at-risk users with recent HF < 1.5. We intentionally re-check ALL
    // at-risk users on every price update rather than filtering by asset —
    // populating a per-user asset list would require an extra RPC pass, and
    // at the 50-user LIMIT the broader check is still fast.
    const { rows: atRiskUsers } = await pool.query(
      `SELECT wallet_address FROM users
       WHERE last_health_factor IS NOT NULL
         AND last_health_factor < 1.5
       LIMIT 50`
    );

    if (atRiskUsers.length === 0) {
      return NextResponse.json({ received: true, atRisk: 0 });
    }

    const addresses = atRiskUsers.map((r: any) => r.wallet_address);
    const accountData = await batchGetUserAccountData(addresses);

    const { alertsCreated } = await processHealthCheck(pool, accountData, "price-update");

    return NextResponse.json({
      received: true,
      atRisk: atRiskUsers.length,
      checked: accountData.length,
      alertsCreated,
    });
  } catch (err: any) {
    console.error("[Goldsky Price Webhook] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
