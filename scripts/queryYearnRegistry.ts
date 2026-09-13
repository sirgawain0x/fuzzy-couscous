/**
 * Script to query Yearn V3 Registry on Base
 *
 * This script helps developers discover available Yearn V3 vaults
 * Run with: npx tsx scripts/queryYearnRegistry.ts
 *
 * Requirements:
 * - Install tsx: pnpm add -D tsx
 * - Or use ts-node: pnpm add -D ts-node
 */

import { createPublicClient, http, Address } from "viem";
import { base } from "viem/chains";
import { YEARN_V3_ADDRESSES, YEARN_REGISTRY_ABI, USDC_ADDRESS_BASE } from "../lib/config/yearn";

// Create a public client to interact with Base
const client = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

/**
 * Query endorsed vaults for USDC on Base
 */
async function queryUsdcVaults() {
  console.log("🔍 Querying Yearn V3 Registry on Base...\n");
  console.log("Registry Address:", YEARN_V3_ADDRESSES.registry);
  console.log("USDC Address:", USDC_ADDRESS_BASE);
  console.log("---\n");

  try {
    // Get endorsed vaults for USDC
    const vaults = await client.readContract({
      address: YEARN_V3_ADDRESSES.registry,
      abi: YEARN_REGISTRY_ABI,
      functionName: "getEndorsedVaults",
      args: [USDC_ADDRESS_BASE],
    });

    console.log(`Found ${vaults.length} endorsed USDC vault(s):\n`);

    if (vaults.length === 0) {
      console.log("⚠️  No Yearn V3 vaults found for USDC on Base yet.");
      console.log("   Check back later or monitor Yearn's deployment announcements.\n");
      return;
    }

    // Get detailed info for each vault
    for (let i = 0; i < vaults.length; i++) {
      const vaultAddress = vaults[i] as Address;
      console.log(`\n📦 Vault ${i + 1}:`);
      console.log(`   Address: ${vaultAddress}`);

      try {
        const info = await client.readContract({
          address: YEARN_V3_ADDRESSES.registry,
          abi: YEARN_REGISTRY_ABI,
          functionName: "vaultInfo",
          args: [vaultAddress],
        });

        console.log(`   Type: ${info.vaultType === 1n ? "Multi-Strategy" : "Single-Strategy"}`);
        console.log(`   Release Version: ${info.releaseVersion}`);
        console.log(`   Tag: ${info.tag || "N/A"}`);
        console.log(
          `   Deployed: ${new Date(Number(info.deploymentTimestamp) * 1000).toLocaleDateString()}`
        );
      } catch (error) {
        console.log(`   ⚠️  Could not fetch vault info: ${error}`);
      }
    }

    console.log("\n✅ Query complete!");
    console.log("\n💡 To integrate these vaults:");
    console.log("   1. Copy the vault address");
    console.log("   2. Open app/strategies/page.tsx");
    console.log("   3. Uncomment the YearnVaultCard component");
    console.log("   4. Replace '0x...' with the actual vault address\n");
  } catch (error) {
    console.error("❌ Error querying registry:", error);
    console.log("\n💡 Possible reasons:");
    console.log("   - Yearn V3 not yet deployed on Base");
    console.log("   - Network connection issues");
    console.log("   - Registry address incorrect\n");
  }
}

/**
 * Query all endorsed vaults (all assets)
 */
async function queryAllVaults() {
  console.log("\n🔍 Querying ALL endorsed vaults on Base...\n");

  try {
    const allVaults = await client.readContract({
      address: YEARN_V3_ADDRESSES.registry,
      abi: YEARN_REGISTRY_ABI,
      functionName: "getAllEndorsedVaults",
    });

    console.log(`Found ${allVaults.length} asset(s) with endorsed vaults:\n`);

    if (allVaults.length === 0) {
      console.log("⚠️  No Yearn V3 vaults found on Base yet.\n");
      return;
    }

    for (let i = 0; i < allVaults.length; i++) {
      const vaultsForAsset = allVaults[i] as Address[];
      console.log(`Asset Group ${i + 1}: ${vaultsForAsset.length} vault(s)`);
      vaultsForAsset.forEach((vault, j) => {
        console.log(`  ${j + 1}. ${vault}`);
      });
    }

    console.log("\n✅ Query complete!\n");
  } catch (error) {
    console.error("❌ Error querying all vaults:", error);
  }
}

// Main execution
async function main() {
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║     Yearn V3 Registry Query Tool - Base Chain     ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  await queryUsdcVaults();
  // Uncomment to query all vaults:
  // await queryAllVaults();
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
