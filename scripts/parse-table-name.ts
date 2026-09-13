/**
 * Script to parse and display table name components
 * Usage: pnpm tsx scripts/parse-table-name.ts
 */

import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const tableName = process.env.TABLELAND_TABLE_NAME || "transactions_8453_26";

// Parse table name: {prefix}_{chainId}_{tableId}
const parts = tableName.split("_");

if (parts.length >= 3) {
  const prefix = parts[0];
  const chainId = parts[1];
  const tableId = parts.slice(2).join("_"); // In case tableId has underscores

  console.log("📋 Table Name Breakdown:");
  console.log("");
  console.log(`   Full Name: ${tableName}`);
  console.log(`   Prefix:    ${prefix}`);
  console.log(`   Chain ID:  ${chainId} (${chainId === "8453" ? "Base Mainnet" : "Unknown"})`);
  console.log(`   Table ID:  ${tableId}`);
  console.log("");
  console.log("💡 The Table ID is what you'd use if you need to reference");
  console.log("   the table by ID instead of full name.");
  console.log("");
} else {
  console.log(`⚠️  Table name format unexpected: ${tableName}`);
  console.log("   Expected format: {prefix}_{chainId}_{tableId}");
}
