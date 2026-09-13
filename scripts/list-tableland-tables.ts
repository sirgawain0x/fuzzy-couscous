/**
 * Script to list all tables owned by the wallet
 * Usage: pnpm tsx scripts/list-tableland-tables.ts
 */

import { Registry } from "@tableland/sdk";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

async function main() {
  try {
    console.log("🔍 Listing Tableland tables...");
    console.log("");

    if (!process.env.TABLELAND_PRIVATE_KEY) {
      throw new Error("TABLELAND_PRIVATE_KEY not found in .env.local");
    }

    const { Wallet, getDefaultProvider } = await import("ethers");
    const baseRpcUrl = "https://mainnet.base.org";

    const wallet = new Wallet(process.env.TABLELAND_PRIVATE_KEY);
    const provider = getDefaultProvider(baseRpcUrl);
    const signer = wallet.connect(provider);

    const registry = new Registry({ signer });

    // Get wallet address
    const address = await signer.getAddress();
    console.log(`📋 Wallet Address: ${address}`);
    console.log("");

    // List all tables owned by this wallet
    console.log("📝 Fetching tables...");
    const tables = await registry.listTables();

    console.log("");
    if (tables.length === 0) {
      console.log("⚠️  No tables found for this wallet address.");
      console.log("");
      console.log("💡 This could mean:");
      console.log("   1. The table was created with a different wallet");
      console.log("   2. The table hasn't been indexed yet");
      console.log("   3. You need to create the table through Studio's interface");
    } else {
      console.log(`✅ Found ${tables.length} table(s):`);
      console.log("");
      tables.forEach((table, index) => {
        console.log(`   ${index + 1}. Table ID: ${table.tableId}`);
        console.log(`      Chain ID: ${table.chainId}`);
        console.log(`      Full Name: transactions_${table.chainId}_${table.tableId}`);
        console.log("");
      });
    }

    console.log("💡 Note: Tables created via SDK are on-chain and accessible,");
    console.log(
      "   but may not appear in Studio until they're created through Studio's interface."
    );
    console.log("");
  } catch (error) {
    console.error("");
    console.error("❌ Error listing tables:");
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
