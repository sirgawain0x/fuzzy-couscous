/**
 * Script to verify the Kalani (Creative Bank) Yearn V3 vault on Base
 *
 * This script verifies:
 * - Vault is a valid ERC-4626 contract
 * - Vault uses USDC as the underlying asset
 * - Vault is connected to Kalani infrastructure
 * - Vault is registered in the Kalani registry
 * - Basic vault state and functionality
 *
 * Run with: npx tsx scripts/verifyKalaniVault.ts
 *
 * Requirements:
 * - Install tsx: pnpm add -D tsx
 */

import { createPublicClient, http, Address, formatUnits } from "viem";
import { base } from "viem/chains";
import { KALANI_VAULT_ADDRESSES, CREATIVE_BANK_VAULT, KALANI_CHAIN_ID } from "../lib/config/kalani";
import { ERC4626_ABI, USDC_ADDRESS_BASE } from "../lib/config/yearn";

// Create a public client to interact with Base
const client = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

// ERC20 ABI for checking token details
const ERC20_ABI = [
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Kalani Registry ABI
const KALANI_REGISTRY_ABI = [
  {
    inputs: [{ internalType: "address", name: "_vault", type: "address" }],
    name: "getVaultInfo",
    outputs: [
      {
        components: [
          { name: "vault", type: "address" },
          { name: "asset", type: "address" },
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllVaults",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Role Manager ABI
const ROLE_MANAGER_ABI = [
  {
    inputs: [],
    name: "getAllVaults",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface VerificationResult {
  check: string;
  status: "✅" | "❌" | "⚠️";
  message: string;
  details?: string;
}

const results: VerificationResult[] = [];

function addResult(check: string, status: "✅" | "❌" | "⚠️", message: string, details?: string) {
  results.push({ check, status, message, details });
}

async function verifyVaultAddress() {
  console.log("🔍 Verifying vault address...\n");
  console.log(`Vault Address: ${CREATIVE_BANK_VAULT.address}`);
  console.log(
    `Expected Asset: ${CREATIVE_BANK_VAULT.asset} (${CREATIVE_BANK_VAULT.assetSymbol})\n`
  );
  console.log("─".repeat(60) + "\n");
}

async function verifyERC4626Compliance() {
  console.log("1️⃣  Checking ERC-4626 Compliance...\n");

  try {
    // Check if asset() function exists and returns correct address
    const asset = await client.readContract({
      address: CREATIVE_BANK_VAULT.address,
      abi: ERC4626_ABI,
      functionName: "asset",
    });

    if (asset.toLowerCase() === CREATIVE_BANK_VAULT.asset.toLowerCase()) {
      addResult(
        "ERC-4626 Asset",
        "✅",
        `Vault asset matches: ${asset}`,
        `Expected: ${CREATIVE_BANK_VAULT.asset}`
      );
    } else {
      addResult(
        "ERC-4626 Asset",
        "❌",
        `Asset mismatch! Got: ${asset}, Expected: ${CREATIVE_BANK_VAULT.asset}`
      );
    }

    // Check totalAssets
    try {
      const totalAssets = await client.readContract({
        address: CREATIVE_BANK_VAULT.address,
        abi: ERC4626_ABI,
        functionName: "totalAssets",
      });
      addResult(
        "Total Assets",
        "✅",
        `Vault has ${formatUnits(totalAssets, 6)} USDC in total assets`
      );
    } catch (error) {
      addResult("Total Assets", "⚠️", "Could not read totalAssets", String(error));
    }

    // Check convertToShares function
    try {
      const testAmount = BigInt(1e6); // 1 USDC
      const shares = await client.readContract({
        address: CREATIVE_BANK_VAULT.address,
        abi: ERC4626_ABI,
        functionName: "convertToShares",
        args: [testAmount],
      });
      addResult("Convert To Shares", "✅", `1 USDC = ${formatUnits(shares, 18)} shares`);
    } catch (error) {
      addResult("Convert To Shares", "⚠️", "Could not test convertToShares", String(error));
    }

    // Check maxDeposit
    try {
      const testReceiver = "0x0000000000000000000000000000000000000000" as Address;
      const maxDeposit = await client.readContract({
        address: CREATIVE_BANK_VAULT.address,
        abi: ERC4626_ABI,
        functionName: "maxDeposit",
        args: [testReceiver],
      });
      addResult(
        "Max Deposit",
        "✅",
        `Max deposit: ${maxDeposit === BigInt(2 ** 256 - 1) ? "Unlimited" : formatUnits(maxDeposit, 6) + " USDC"}`
      );
    } catch (error) {
      addResult("Max Deposit", "⚠️", "Could not read maxDeposit", String(error));
    }
  } catch (error) {
    addResult("ERC-4626 Compliance", "❌", "Failed to verify ERC-4626 compliance", String(error));
  }
}

async function verifyAssetToken() {
  console.log("\n2️⃣  Verifying Underlying Asset (USDC)...\n");

  try {
    const symbol = await client.readContract({
      address: CREATIVE_BANK_VAULT.asset,
      abi: ERC20_ABI,
      functionName: "symbol",
    });

    const name = await client.readContract({
      address: CREATIVE_BANK_VAULT.asset,
      abi: ERC20_ABI,
      functionName: "name",
    });

    const decimals = await client.readContract({
      address: CREATIVE_BANK_VAULT.asset,
      abi: ERC20_ABI,
      functionName: "decimals",
    });

    if (symbol === CREATIVE_BANK_VAULT.assetSymbol) {
      addResult("Asset Symbol", "✅", `Token symbol: ${symbol}`);
    } else {
      addResult(
        "Asset Symbol",
        "❌",
        `Symbol mismatch! Got: ${symbol}, Expected: ${CREATIVE_BANK_VAULT.assetSymbol}`
      );
    }

    addResult("Asset Name", "✅", `Token name: ${name}`);
    addResult("Asset Decimals", "✅", `Decimals: ${decimals}`);
  } catch (error) {
    addResult("Asset Verification", "❌", "Failed to verify asset token", String(error));
  }
}

async function verifyKalaniRegistry() {
  console.log("\n3️⃣  Verifying Kalani Registry Connection...\n");

  try {
    // Check if vault is in the registry
    const allVaults = await client.readContract({
      address: KALANI_VAULT_ADDRESSES.registry,
      abi: KALANI_REGISTRY_ABI,
      functionName: "getAllVaults",
    });

    const isRegistered = (allVaults as Address[]).some(
      (vault) => vault.toLowerCase() === CREATIVE_BANK_VAULT.address.toLowerCase()
    );

    if (isRegistered) {
      addResult("Registry Registration", "✅", "Vault is registered in Kalani registry");
    } else {
      addResult(
        "Registry Registration",
        "⚠️",
        "Vault not found in registry (may use different registry)",
        `Found ${allVaults.length} vault(s) in registry`
      );
    }

    // Try to get vault info from registry
    try {
      const vaultInfo = await client.readContract({
        address: KALANI_VAULT_ADDRESSES.registry,
        abi: KALANI_REGISTRY_ABI,
        functionName: "getVaultInfo",
        args: [CREATIVE_BANK_VAULT.address],
      });
      addResult(
        "Registry Info",
        "✅",
        `Registry name: ${vaultInfo.name}, Symbol: ${vaultInfo.symbol}`
      );
    } catch (error) {
      // This might fail if the registry doesn't have this function
      addResult("Registry Info", "⚠️", "Could not fetch vault info from registry", String(error));
    }
  } catch (error) {
    addResult("Registry Connection", "⚠️", "Could not verify registry connection", String(error));
  }
}

async function verifyRoleManager() {
  console.log("\n4️⃣  Verifying Role Manager Connection...\n");

  try {
    const vaults = await client.readContract({
      address: KALANI_VAULT_ADDRESSES.roleManager,
      abi: ROLE_MANAGER_ABI,
      functionName: "getAllVaults",
    });

    const isManaged = (vaults as Address[]).some(
      (vault) => vault.toLowerCase() === CREATIVE_BANK_VAULT.address.toLowerCase()
    );

    if (isManaged) {
      addResult("Role Manager", "✅", "Vault is managed by Role Manager");
    } else {
      addResult(
        "Role Manager",
        "⚠️",
        "Vault not found in Role Manager (may use different manager)",
        `Found ${vaults.length} vault(s) in role manager`
      );
    }
  } catch (error) {
    addResult("Role Manager", "⚠️", "Could not verify Role Manager connection", String(error));
  }
}

async function verifyVaultToken() {
  console.log("\n5️⃣  Verifying Vault Share Token...\n");

  try {
    // Try to read as ERC20 token (vault shares are ERC20)
    const symbol = await client.readContract({
      address: CREATIVE_BANK_VAULT.address,
      abi: ERC20_ABI,
      functionName: "symbol",
    });

    const name = await client.readContract({
      address: CREATIVE_BANK_VAULT.address,
      abi: ERC20_ABI,
      functionName: "name",
    });

    if (symbol === CREATIVE_BANK_VAULT.symbol) {
      addResult("Vault Symbol", "✅", `Share token symbol: ${symbol}`);
    } else {
      addResult(
        "Vault Symbol",
        "⚠️",
        `Symbol mismatch! Got: ${symbol}, Expected: ${CREATIVE_BANK_VAULT.symbol}`
      );
    }

    if (name.includes(CREATIVE_BANK_VAULT.name) || name.includes("Creative Bank")) {
      addResult("Vault Name", "✅", `Share token name: ${name}`);
    } else {
      addResult(
        "Vault Name",
        "⚠️",
        `Name mismatch! Got: ${name}, Expected: ${CREATIVE_BANK_VAULT.name}`
      );
    }
  } catch (error) {
    addResult("Vault Token", "⚠️", "Could not verify vault share token", String(error));
  }
}

async function verifyContractCode() {
  console.log("\n6️⃣  Verifying Contract Code...\n");

  try {
    const code = await client.getBytecode({ address: CREATIVE_BANK_VAULT.address });

    if (code && code !== "0x") {
      addResult("Contract Code", "✅", "Contract has bytecode (is deployed)");

      // Check if contract is verified on Basescan
      addResult(
        "Contract Verification",
        "⚠️",
        "Check verification status on Basescan",
        `https://basescan.org/address/${CREATIVE_BANK_VAULT.address}#code`
      );
    } else {
      addResult("Contract Code", "❌", "No bytecode found - contract may not be deployed");
    }
  } catch (error) {
    addResult("Contract Code", "❌", "Failed to check contract code", String(error));
  }
}

function printResults() {
  console.log("\n" + "═".repeat(60));
  console.log("📊 VERIFICATION RESULTS");
  console.log("═".repeat(60) + "\n");

  const passed = results.filter((r) => r.status === "✅").length;
  const failed = results.filter((r) => r.status === "❌").length;
  const warnings = results.filter((r) => r.status === "⚠️").length;

  results.forEach((result) => {
    console.log(`${result.status} ${result.check}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
    console.log();
  });

  console.log("─".repeat(60));
  console.log(`Summary: ${passed} passed, ${warnings} warnings, ${failed} failed\n`);

  if (failed === 0) {
    console.log("✅ Vault verification complete! All critical checks passed.\n");
  } else {
    console.log("❌ Some critical checks failed. Please review the errors above.\n");
  }

  console.log("💡 Useful Links:");
  console.log(`   Basescan: https://basescan.org/address/${CREATIVE_BANK_VAULT.address}`);
  console.log(`   Vault Asset: https://basescan.org/address/${CREATIVE_BANK_VAULT.asset}`);
  console.log(
    `   Role Manager: https://basescan.org/address/${KALANI_VAULT_ADDRESSES.roleManager}`
  );
  console.log(`   Registry: https://basescan.org/address/${KALANI_VAULT_ADDRESSES.registry}\n`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   Kalani Vault Verification Tool - Creative Bank        ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  await verifyVaultAddress();
  await verifyERC4626Compliance();
  await verifyAssetToken();
  await verifyKalaniRegistry();
  await verifyRoleManager();
  await verifyVaultToken();
  await verifyContractCode();

  printResults();
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
