import { createHmac, timingSafeEqual } from "crypto";
import type { Pool } from "pg";

export type CrossmintWebhookEvent = {
  id?: string;
  type?: string;
  event?: string;
  data?: Record<string, unknown>;
};

export type WebhookVerifyResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** Ledger-related Crossmint wallet transfer webhook types. */
export const CROSSMINT_TRANSFER_WEBHOOK_TYPES = [
  "wallets.transfer.in",
  "wallets.transfer.out",
  "wallets.transfer.transaction.update",
  "wallets.experimental.transfer.updated",
] as const;

const isProduction = process.env.NODE_ENV === "production";

const COMPLETED_STATUSES = new Set(["succeeded", "completed", "successful", "confirmed"]);
const FAILED_STATUSES = new Set(["failed", "error", "reverted", "cancelled", "canceled"]);

/**
 * Verifies Crossmint webhook HMAC (timestamp.body) per Crossmint docs.
 * Production fails closed when secret or headers are missing.
 */
export function verifyCrossmintWebhook(
  body: string,
  signature: string | null,
  timestamp: string | null,
  secret: string | undefined
): WebhookVerifyResult {
  if (isProduction && !secret) {
    return { ok: false, status: 500, error: "Webhook secret not configured" };
  }

  if (!secret) {
    return { ok: true };
  }

  if (!signature || !timestamp) {
    return { ok: false, status: 401, error: "Missing signature headers" };
  }

  const key = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const payload = `${timestamp}.${body}`;
  const computed = createHmac("sha256", key).update(payload).digest("hex");

  try {
    if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(computed, "hex"))) {
      return { ok: false, status: 401, error: "Invalid signature" };
    }
  } catch {
    return { ok: false, status: 401, error: "Invalid signature" };
  }

  const timestampMs = Number(timestamp) * 1000;
  if (Number.isNaN(timestampMs) || Date.now() - timestampMs > 5 * 60 * 1000) {
    return { ok: false, status: 401, error: "Timestamp too old" };
  }

  return { ok: true };
}

function normalizeAddress(address: string | null | undefined): string | null {
  if (!address || typeof address !== "string") return null;
  return address.toLowerCase();
}

type TransferParty = { address?: string; owner?: string };

type TransferToken = {
  amount?: string;
  symbol?: string;
  contractAddress?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as Record<string, unknown>;
}

/** Unwrap nested transaction/transfer objects used by lifecycle webhooks. */
function normalizeTransferData(data: Record<string, unknown>): Record<string, unknown> {
  const transaction = asRecord(data.transaction);
  const transfer = asRecord(data.transfer);

  return {
    ...transfer,
    ...transaction,
    ...data,
    sender: data.sender ?? transfer?.sender ?? transaction?.sender,
    recipient: data.recipient ?? transfer?.recipient ?? transaction?.recipient,
    token: data.token ?? transfer?.token ?? transaction?.token,
    status:
      data.status ??
      transfer?.status ??
      transaction?.status ??
      data.transactionStatus ??
      transfer?.transactionStatus,
    transferId:
      data.transferId ??
      transfer?.transferId ??
      transaction?.transferId ??
      data.transactionId ??
      transaction?.id,
    onChain: data.onChain ?? transfer?.onChain ?? transaction?.onChain,
    direction: data.direction ?? transfer?.direction ?? transaction?.direction,
    type: data.type ?? transfer?.type ?? transaction?.type,
    walletAddress:
      data.walletAddress ??
      (data.wallet as { address?: string } | undefined)?.address ??
      transfer?.walletAddress ??
      transaction?.walletAddress,
  };
}

function resolveTransferDirection(
  eventType: string,
  data: Record<string, unknown>
): "in" | "out" | null {
  if (eventType === "wallets.transfer.in") return "in";
  if (eventType === "wallets.transfer.out") return "out";

  const direction = String(data.direction ?? data.flow ?? "").toLowerCase();
  if (direction === "in" || direction === "incoming" || direction === "deposit") return "in";
  if (direction === "out" || direction === "outgoing" || direction === "payout") return "out";

  const typeHint = String(data.type ?? "").toLowerCase();
  if (typeHint.includes("transfer.in") || typeHint === "deposit") return "in";
  if (typeHint.includes("transfer.out") || typeHint === "payout") return "out";

  const senderParty = data.sender as TransferParty | undefined;
  const recipientParty = data.recipient as TransferParty | undefined;
  if (recipientParty?.address && !senderParty?.address) return "in";
  if (senderParty?.address && !recipientParty?.address) return "out";

  return null;
}

/**
 * Resolves the project wallet address for audit / ledger rows.
 */
export function extractWalletAddressFromEvent(
  eventType: string,
  data: Record<string, unknown> | undefined
): string | null {
  if (!data) return null;

  const normalized = normalizeTransferData(data);
  const sender = normalized.sender as TransferParty | undefined;
  const recipient = normalized.recipient as TransferParty | undefined;
  const direction = resolveTransferDirection(eventType, normalized);

  if (direction === "in") {
    return normalizeAddress(recipient?.address ?? (normalized.walletAddress as string));
  }
  if (direction === "out") {
    return normalizeAddress(sender?.address ?? (normalized.walletAddress as string));
  }

  if (eventType === "wallets.transfer.in") {
    return normalizeAddress(recipient?.address);
  }
  if (eventType === "wallets.transfer.out") {
    return normalizeAddress(sender?.address);
  }

  const legacy =
    (normalized.walletAddress as string) ||
    recipient?.address ||
    sender?.address ||
    (normalized.address as string);

  return normalizeAddress(legacy);
}

function transferTransactionId(event: CrossmintWebhookEvent, data: Record<string, unknown>): string {
  const transferId = data.transferId as string | undefined;
  const transactionId = data.transactionId as string | undefined;
  const onChain = data.onChain as { txId?: string } | undefined;
  if (transferId) return transferId;
  if (transactionId) return transactionId;
  if (event.id) return event.id;
  if (onChain?.txId) return onChain.txId;
  return `crossmint-${Date.now()}`;
}

function normalizeLedgerStatus(status: string): string | null {
  const normalized = status.toLowerCase();
  if (COMPLETED_STATUSES.has(normalized)) return "succeeded";
  if (FAILED_STATUSES.has(normalized)) return "failed";
  return null;
}

function isTransferLedgerEvent(eventType: string): boolean {
  return (CROSSMINT_TRANSFER_WEBHOOK_TYPES as readonly string[]).includes(eventType);
}

/**
 * Persists Crossmint transfer webhooks into the transactions ledger when a
 * deposit or payout reaches a terminal state (succeeded / failed).
 */
export async function handleCrossmintTransferEvent(
  pool: Pool,
  event: CrossmintWebhookEvent,
  eventType: string
): Promise<void> {
  if (!isTransferLedgerEvent(eventType)) return;

  const rawData = event.data;
  if (!rawData || typeof rawData !== "object") return;

  const data = normalizeTransferData(rawData);
  const rawStatus = String(data.status ?? "unknown");
  const ledgerStatus = normalizeLedgerStatus(rawStatus);

  // Only write to the ledger on terminal states (deposit/payout complete or failed).
  if (!ledgerStatus) return;

  const direction = resolveTransferDirection(eventType, data);
  if (!direction) return;

  const walletAddress = extractWalletAddressFromEvent(eventType, rawData);
  if (!walletAddress) return;

  const sender = data.sender as TransferParty | undefined;
  const recipient = data.recipient as TransferParty | undefined;
  const token = data.token as TransferToken | undefined;
  const onChain = data.onChain as { txId?: string } | undefined;

  const txType = direction === "in" ? "transfer_in" : "transfer_out";
  const transactionId = transferTransactionId(event, data);

  const { rows: userRows } = await pool.query<{ crossmint_user_id: string | null }>(
    `SELECT crossmint_user_id FROM users WHERE wallet_address = $1 LIMIT 1`,
    [walletAddress]
  );
  const crossmintUserId = userRows[0]?.crossmint_user_id ?? null;

  const amount = token?.amount ?? null;
  const currency = token?.symbol ?? "USDC";
  const isIncoming = direction === "in";

  await pool.query(
    `INSERT INTO transactions (
        wallet_address, crossmint_user_id, transaction_id, type, status,
        to_address, from_address,
        buy_amount_value, buy_amount_currency,
        sell_amount_value, sell_amount_currency,
        onchain_hash, raw_data, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
      ON CONFLICT (transaction_id) DO UPDATE SET
        status = EXCLUDED.status,
        type = EXCLUDED.type,
        to_address = EXCLUDED.to_address,
        from_address = EXCLUDED.from_address,
        buy_amount_value = EXCLUDED.buy_amount_value,
        buy_amount_currency = EXCLUDED.buy_amount_currency,
        sell_amount_value = EXCLUDED.sell_amount_value,
        sell_amount_currency = EXCLUDED.sell_amount_currency,
        onchain_hash = COALESCE(EXCLUDED.onchain_hash, transactions.onchain_hash),
        raw_data = EXCLUDED.raw_data,
        updated_at = now()`,
    [
      walletAddress,
      crossmintUserId,
      transactionId,
      txType,
      ledgerStatus,
      normalizeAddress(recipient?.address),
      normalizeAddress(sender?.address),
      isIncoming ? amount : null,
      isIncoming ? currency : null,
      isIncoming ? null : amount,
      isIncoming ? null : currency,
      onChain?.txId ?? null,
      JSON.stringify(event),
    ]
  );
}

type UserWebhookData = {
  id?: string;
  userId?: string;
  email?: string;
  phoneNumber?: string;
  newEmail?: string;
  newPhoneNumber?: string;
};

/**
 * Syncs Crossmint Auth user directory events into CockroachDB.
 * @see https://docs.crossmint.com/authentication/webhooks#user-webhooks
 */
export async function handleCrossmintUserEvent(
  pool: Pool,
  eventType: string,
  data: Record<string, unknown> | undefined
): Promise<void> {
  if (!data) return;

  const payload = data as UserWebhookData;

  if (eventType === "users.created") {
    const crossmintUserId = payload.id;
    if (!crossmintUserId) return;

    await pool.query(
      `INSERT INTO users (crossmint_user_id, email, phone_number, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (crossmint_user_id) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, users.email),
         phone_number = COALESCE(EXCLUDED.phone_number, users.phone_number),
         updated_at = now()`,
      [crossmintUserId, payload.email ?? null, payload.phoneNumber ?? null]
    );
    return;
  }

  if (eventType === "users.updated") {
    const crossmintUserId = payload.userId;
    if (!crossmintUserId) return;

    await pool.query(
      `UPDATE users SET
         email = COALESCE($2, email),
         phone_number = COALESCE($3, phone_number),
         updated_at = now()
       WHERE crossmint_user_id = $1`,
      [
        crossmintUserId,
        payload.newEmail ?? payload.email ?? null,
        payload.newPhoneNumber ?? payload.phoneNumber ?? null,
      ]
    );
  }
}
