/**
 * Script to initialize the Tableland transactions table
 * Usage: pnpm tsx scripts/init-tableland.ts
 */

import { initTransactionsTable } from "@/server-actions/initTableland";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local first, then .env
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

async function main() {
  try {
    console.log("🚀 Initializing Tableland transactions table...");
    console.log("🌐 Network: Base Mainnet (Chain ID: 8453)");
    console.log("");

    if (!process.env.TABLELAND_PRIVATE_KEY) {
      throw new Error(
        "❌ TABLELAND_PRIVATE_KEY not found in .env.local\n" +
          "Please add your private key to .env.local"
      );
    }

    console.log("✅ Private key found");
    console.log("📝 Creating table...");
    console.log("");

    const tableName = await initTransactionsTable();

    console.log("");
    console.log("✅ Success! Table created:");
    console.log(`   Table Name: ${tableName}`);
    console.log("");
    console.log("📝 Next steps:");
    console.log(`   1. Add this to your .env.local:`);
    console.log(`      TABLELAND_TABLE_NAME=${tableName}`);
    console.log("");
    console.log("   2. Restart your dev server if it's running");
    console.log("");
  } catch (error) {
    console.error("");
    console.error("❌ Error initializing table:");
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
