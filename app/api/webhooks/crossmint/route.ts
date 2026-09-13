import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/cockroachdb";
import {
  verifyCrossmintWebhook,
  extractWalletAddressFromEvent,
  handleCrossmintTransferEvent,
  handleCrossmintUserEvent,
  type CrossmintWebhookEvent,
} from "@/lib/crossmint-webhook";

/**
 * POST /api/webhooks/crossmint
 * Crossmint wallet + transfer webhooks (signature-verified, audit + ledger).
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-crossmint-signature");
  const timestamp = request.headers.get("x-crossmint-timestamp");
  const secret = process.env.CROSSMINT_WEBHOOK_SECRET;

  const verification = verifyCrossmintWebhook(body, signature, timestamp, secret);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }

  try {
    const event = JSON.parse(body) as CrossmintWebhookEvent;
    const eventType = event.type || event.event || "unknown";
    const eventId = event.id || `crossmint-${Date.now()}`;
    const walletAddress = extractWalletAddressFromEvent(eventType, event.data);

    if (!process.env.COCKROACHDB_URL) {
      return NextResponse.json({ received: true });
    }

    const pool = getPool();

    const { rowCount } = await pool.query(
      `INSERT INTO webhook_events (event_type, event_id, source, payload, wallet_address, status)
       VALUES ($1, $2, 'crossmint', $3, $4, 'processed')
       ON CONFLICT (event_id) DO NOTHING
       RETURNING id`,
      [eventType, eventId, JSON.stringify(event), walletAddress]
    );

    if (rowCount && rowCount > 0) {
      await handleCrossmintTransferEvent(pool, event, eventType);
      await handleCrossmintUserEvent(pool, eventType, event.data);
    }

    console.log(`[Crossmint Webhook] ${eventType} for ${walletAddress || "unknown"}`);

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    console.error("[Crossmint Webhook] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
