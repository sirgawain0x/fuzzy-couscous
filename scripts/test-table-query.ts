/**
 * Script to test querying the Tableland table with the exact table name
 * Usage: pnpm tsx scripts/test-table-query.ts
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

    console.log("🧪 Testing Tableland table query...");
    console.log(`📋 Table Name: ${tableName}`);
    console.log("");

    if (!process.env.TABLELAND_PRIVATE_KEY) {
      throw new Error("TABLELAND_PRIVATE_KEY not found");
    }

    const db = await getTablelandDatabase();

    // Test 1: Query without quotes
    console.log("Test 1: Query without quotes");
    try {
      const { results } = await db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).all();
      console.log(`✅ Success! Count: ${results[0]?.count || 0}`);
    } catch (error: any) {
      console.log(`❌ Failed: ${error.message}`);
    }
    console.log("");

    // Test 2: Query with quotes
    console.log("Test 2: Query with quotes");
    try {
      const { results } = await db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).all();
      console.log(`✅ Success! Count: ${results[0]?.count || 0}`);
    } catch (error: any) {
      console.log(`❌ Failed: ${error.message}`);
    }
    console.log("");

    // Test 3: Query with WHERE clause
    console.log("Test 3: Query with WHERE clause (quoted)");
    try {
      const { results } = await db
        .prepare(`SELECT * FROM "${tableName}" WHERE user_id = ? LIMIT 1`)
        .bind("test_user")
        .all();
      console.log(`✅ Success! Found ${results.length} rows`);
    } catch (error: any) {
      console.log(`❌ Failed: ${error.message}`);
    }
    console.log("");

    console.log("✅ All tests completed!");
    console.log("");
    console.log("💡 If you're seeing 'Invalid table name' in Studio:");
    console.log("   1. Make sure you're using the full table name: transactions_8453_26");
    console.log('   2. Try quoting it: "transactions_8453_26"');
    console.log("   3. Tables created via SDK work, but may not show in Studio Definitions");
    console.log("");
  } catch (error) {
    console.error("");
    console.error("❌ Error:");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error("   Unknown error:", error);
    }
    console.error("");
    process.exit(1);
  }
}

main();
