import { Database } from "@tableland/sdk";

// Get Tableland database instance (server-side only)
// Uses private key from env for server-side operations
export const getTablelandDatabase = async () => {
  if (!process.env.TABLELAND_PRIVATE_KEY) {
    throw new Error("TABLELAND_PRIVATE_KEY is required for server-side Tableland operations");
  }

  const { Wallet, getDefaultProvider } = await import("ethers");

  // Use public Base RPC for server-side (Alchemy keys often have origin restrictions)
  // getDefaultProvider can try multiple providers, but we specify Base mainnet
  const baseRpcUrl = "https://mainnet.base.org";

  const wallet = new Wallet(process.env.TABLELAND_PRIVATE_KEY);
  // Use getDefaultProvider as recommended in Tableland docs, with explicit Base URL
  const provider = getDefaultProvider(baseRpcUrl);
  const signer = wallet.connect(provider);

  // Database constructor only needs signer - chain is inferred from signer
  // Project ID and Environment ID are used for Tableland Cloud API, not the SDK
  const db = new Database({ signer });

  return db;
};

// Table schema definition
export const TRANSACTIONS_TABLE_SCHEMA = `
  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    to_address TEXT,
    from_address TEXT,
    sell_amount_value TEXT,
    sell_amount_currency TEXT,
    buy_amount_value TEXT,
    buy_amount_currency TEXT,
    onchain_hash TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    raw_data TEXT
  );
`;
