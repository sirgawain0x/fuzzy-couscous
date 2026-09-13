/**
 * Script to verify the Tableland table exists and query it
 * Usage: pnpm tsx scripts/verify-tableland-table.ts
 */

import { getTablelandDatabase } from "@/lib/tableland";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

async function main() {
  try {
    const tableName = process.env.TABLELAND_TABLE_NAME || "transactions_8453_26";

    console.log("🔍 Verifying Tableland table...");
    console.log(`📋 Table Name: ${tableName}`);
    console.log("");

    if (!process.env.TABLELAND_PRIVATE_KEY) {
      throw new Error("TABLELAND_PRIVATE_KEY not found in .env.local");
    }

    const db = await getTablelandDatabase();

    // Try to query the table to verify it exists
    console.log("📝 Querying table...");
    const { results } = await db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).all();

    console.log("");
    console.log("✅ Table exists and is accessible!");
    console.log(`   Row count: ${results[0]?.count || 0}`);
    console.log("");
    console.log("📊 Table Info:");
    console.log(`   Full Name: ${tableName}`);
    console.log(`   Chain ID: 8453 (Base Mainnet)`);
    console.log("");
    console.log("💡 Note: Tables created via SDK may not appear in Studio immediately.");
    console.log("   You can query them directly using the SDK or Validator API.");
    console.log("");
  } catch (error) {
    console.error("");
    console.error("❌ Error verifying table:");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if (error.message.includes("no such table")) {
        console.error("");
        console.error("💡 The table might not exist. Try running:");
        console.error("   pnpm tsx scripts/init-tableland.ts");
      }
    } else {
      console.error("   Unknown error:", error);
    }
    console.error("");
    process.exit(1);
  }
}

main();
