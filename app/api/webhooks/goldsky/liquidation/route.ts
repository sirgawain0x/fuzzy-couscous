import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getPool } from "@/lib/cockroachdb";

/**
 * POST /api/webhooks/goldsky/liquidation
 * Handles Aave V3 LiquidationCall events indexed by Goldsky.
 * Logs the liquidation to CockroachDB for post-mortem reporting.
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

    // Extract LiquidationCall event fields
    const {
      user,
      collateralAsset,
      debtAsset,
      debtToCover,
      liquidatedCollateralAmount,
      transactionHash,
    } = payload;

    if (!user || !transactionHash) {
      return NextResponse.json(
        { error: "Missing required fields: user, transactionHash" },
        { status: 400 }
      );
    }

    if (!process.env.COCKROACHDB_URL) {
      return NextResponse.json({ received: true, skipped: "no database" });
    }

    const pool = getPool();
    const walletAddress = user.toLowerCase();

    // Log webhook event
    const eventId = `liquidation-${transactionHash}`;
    await pool.query(
      `INSERT INTO webhook_events (event_type, event_id, source, payload, wallet_address, status)
       VALUES ('liquidation', $1, 'goldsky', $2, $3, 'processed')
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, JSON.stringify(payload), walletAddress]
    );

    // Store raw amounts in native decimals as strings — Postgres NUMERIC
    // preserves arbitrary precision, and passing JS Number() would lose
    // precision above 2^53 for 18-decimal assets.
    const collateralLostRaw = String(liquidatedCollateralAmount ?? "0");
    const debtClearedRaw = String(debtToCover ?? "0");

    // USD penalty cannot be computed from the webhook payload alone — it
    // requires oracle prices for both assets at the liquidation block.
    // Leave null here; a reporting job can backfill using a price feed.
    const penaltyUsd: number | null = null;

    await pool.query(
      `INSERT INTO liquidations
       (wallet_address, collateral_asset, debt_asset, collateral_lost, debt_cleared,
        liquidation_penalty_usd, tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tx_hash) DO NOTHING`,
      [
        walletAddress,
        collateralAsset || "unknown",
        debtAsset || "unknown",
        collateralLostRaw,
        debtClearedRaw,
        penaltyUsd,
        transactionHash,
      ]
    );

    // Create a high-priority danger alert. The UI formats the raw amount
    // using the asset's decimals, so keep this message asset-agnostic.
    await pool.query(
      `INSERT INTO health_alerts
       (wallet_address, alert_type, current_status, health_factor, message, email_queued)
       VALUES ($1, 'danger', 'liquidated', 0, $2, true)`,
      [
        walletAddress,
        `Your position was liquidated. Collateral was seized to cover your debt. Review the post-mortem in your Reports section.`,
      ]
    );

    console.log(`[Liquidation] Recorded for ${walletAddress}: tx ${transactionHash}`);

    return NextResponse.json({ received: true, recorded: true });
  } catch (err: any) {
    console.error("[Goldsky Liquidation Webhook] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
