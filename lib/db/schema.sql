-- Creative Bank Ledger Schema
-- CockroachDB Serverless on GCP (us-east1)

CREATE TABLE IF NOT EXISTS users (
  crossmint_user_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  phone_number_verified_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  membership_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet_address
  ON users (wallet_address);

CREATE TABLE IF NOT EXISTS phone_otp_challenges (
  crossmint_user_id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_transactions_wallet_address
  ON transactions (wallet_address);

CREATE INDEX IF NOT EXISTS idx_transactions_crossmint_user_id
  ON transactions (crossmint_user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON transactions (status);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at
  ON transactions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_wallet_status
  ON transactions (wallet_address, status, created_at DESC);
