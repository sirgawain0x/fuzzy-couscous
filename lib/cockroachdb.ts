import { Pool } from "pg";

let pool: Pool | null = null;

/**
 * Returns a singleton PostgreSQL connection pool for CockroachDB Serverless (GCP us-east1).
 * Uses the standard `pg` driver — same pattern as Creative TV's Supabase setup.
 * CockroachDB is wire-compatible with PostgreSQL.
 */
export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.COCKROACHDB_URL;
  if (!connectionString) {
    throw new Error(
      "COCKROACHDB_URL is required. Set it to your CockroachDB Serverless connection string."
    );
  }

  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: true },
  });

  pool.on("error", (err) => {
    console.error("[CockroachDB] Unexpected pool error:", err.message);
  });

  return pool;
}

/**
 * Run the database schema migration.
 * Safe to call multiple times — all statements use IF NOT EXISTS.
 *
 * Schema design:
 * - `users` table: Crossmint user_id is the primary key, linked to wallet address
 * - `transactions` table: Ledger entries keyed by wallet_address for lookups
 */
export async function runMigration(): Promise<void> {
  const db = getPool();

  const renameColumnIfNeeded = async (
    table: string,
    fromColumn: string,
    toColumn: string
  ): Promise<void> => {
    const { rows } = await db.query<{ from_exists: boolean; to_exists: boolean }>(
      `SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
        ) AS from_exists,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 AND column_name = $3
        ) AS to_exists`,
      [table, fromColumn, toColumn]
    );
    const { from_exists, to_exists } = rows[0] ?? {};
    if (from_exists && !to_exists) {
      await db.query(
        `ALTER TABLE "${table}" RENAME COLUMN "${fromColumn}" TO "${toColumn}"`
      );
    }
  };

  // Users table — Crossmint user ID is the primary identity
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      crossmint_user_id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      email TEXT,
      phone_number TEXT,
      phone_number_verified_at TIMESTAMPTZ,
      membership_tier TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Migrate legacy Stytch column name if present (CockroachDB rejects ALTER in DO blocks)
  await renameColumnIfNeeded("users", "stytch_user_id", "crossmint_user_id");

  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number_verified_at TIMESTAMPTZ;
  `);

  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS phone_otp_challenges (
      crossmint_user_id TEXT PRIMARY KEY,
      phone_number TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet_address
    ON users (wallet_address);
  `);

  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS crossmint_user_id TEXT;
  `);

  await db.query(`
    ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_crossmint_user_id
    ON users (crossmint_user_id)
    WHERE crossmint_user_id IS NOT NULL;
  `);

  // Transactions table — the bank ledger
  await db.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_address TEXT NOT NULL,
      crossmint_user_id TEXT,
      transaction_id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'offramp',
      status TEXT NOT NULL DEFAULT 'unknown',
      to_address TEXT,
      from_address TEXT,
      sell_amount_value TEXT,
      sell_amount_currency TEXT,
      buy_amount_value TEXT,
      buy_amount_currency TEXT,
      onchain_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      raw_data JSONB
    );
  `);

  // Primary lookup: by wallet address (how we query everywhere)
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_wallet_address
    ON transactions (wallet_address);
  `);

  await renameColumnIfNeeded("transactions", "stytch_user_id", "crossmint_user_id");

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_crossmint_user_id
    ON transactions (crossmint_user_id);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON transactions (status);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at
    ON transactions (created_at DESC);
  `);

  // Composite index for the most common query pattern
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_wallet_status
    ON transactions (wallet_address, status, created_at DESC);
  `);

  // Add monitoring columns to users table (safe to run multiple times)
  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_health_factor NUMERIC;
  `);
  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS collateral_assets JSONB DEFAULT '[]';
  `);

  // Webhook events — audit trail for Crossmint + Goldsky
  await db.query(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type TEXT NOT NULL,
      event_id TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL DEFAULT 'crossmint',
      payload JSONB NOT NULL,
      wallet_address TEXT,
      status TEXT NOT NULL DEFAULT 'received',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_webhook_events_wallet
    ON webhook_events (wallet_address, created_at DESC);
  `);

  // Health factor snapshots — periodic monitoring readings
  await db.query(`
    CREATE TABLE IF NOT EXISTS health_factor_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_address TEXT NOT NULL,
      health_factor NUMERIC NOT NULL,
      status TEXT NOT NULL,
      total_collateral_base NUMERIC,
      total_debt_base NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_hf_snapshots_wallet_time
    ON health_factor_snapshots (wallet_address, created_at DESC);
  `);

  // Health alerts — threshold breach notifications
  await db.query(`
    CREATE TABLE IF NOT EXISTS health_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_address TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      previous_status TEXT,
      current_status TEXT NOT NULL,
      health_factor NUMERIC NOT NULL,
      message TEXT NOT NULL,
      acknowledged BOOLEAN NOT NULL DEFAULT false,
      email_queued BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      acknowledged_at TIMESTAMPTZ
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_health_alerts_wallet_ack
    ON health_alerts (wallet_address, acknowledged, created_at DESC);
  `);

  // Liquidation events — Aave V3 LiquidationCall post-mortem
  await db.query(`
    CREATE TABLE IF NOT EXISTS liquidations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_address TEXT NOT NULL,
      collateral_asset TEXT NOT NULL,
      debt_asset TEXT NOT NULL,
      collateral_lost NUMERIC NOT NULL,
      collateral_lost_usd NUMERIC,
      debt_cleared NUMERIC NOT NULL,
      debt_cleared_usd NUMERIC,
      liquidation_penalty_usd NUMERIC,
      asset_price_at_event NUMERIC,
      tx_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_liquidations_wallet
    ON liquidations (wallet_address, created_at DESC);
  `);

  console.log("[CockroachDB] Migration complete — all tables ready");
}
