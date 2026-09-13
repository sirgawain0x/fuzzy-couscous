/**
 * Script to extract vault address from a deployment transaction
 * Usage: npx tsx scripts/getVaultFromTx.ts <transaction_hash>
 */

import { createPublicClient, http, parseEventLogs } from "viem";
import { base } from "viem/chains";

const txHash = process.argv[2];

if (!txHash) {
  console.error("Please provide a transaction hash");
  console.error("Usage: npx tsx scripts/getVaultFromTx.ts <transaction_hash>");
  process.exit(1);
}

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

async function getVaultAddress() {
  try {
    console.log(`Fetching transaction: ${txHash}...`);

    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    console.log("\n📋 Transaction Receipt:");
    console.log(`Status: ${receipt.status}`);
    console.log(`Block Number: ${receipt.blockNumber}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);

    // Check for contract creation
    if (receipt.contractAddress) {
      console.log(`\n✅ Contract Created: ${receipt.contractAddress}`);
      return receipt.contractAddress;
    }

    // Check logs for vault creation events
    console.log(`\n📝 Analyzing ${receipt.logs.length} event logs...`);

    // Aave vault factory event signatures:
    // VaultDeployed(address indexed vault, address indexed implementation, address indexed underlying, ...)
    // Event signature: 0xa225f10988fd8a4e80df4ed9fe9ddce048ffc02e51061eb4ceb5beb0c2ec4f2a
    const VAULT_DEPLOYED_EVENT_SIGNATURE =
      "0xa225f10988fd8a4e80df4ed9fe9ddce048ffc02e51061eb4ceb5beb0c2ec4f2a";

    const potentialVaults: string[] = [];

    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];

      // Look for VaultDeployed event
      // VaultDeployed(address indexed vault, address indexed implementation, address indexed underlying, ...)
      if (
        log.topics[0]?.toLowerCase() === VAULT_DEPLOYED_EVENT_SIGNATURE.toLowerCase() &&
        log.topics.length >= 4
      ) {
        // Second topic (index 1) is the vault address
        const topic1 = log.topics[1];
        const topic2 = log.topics[2];
        const topic3 = log.topics[3];

        if (!topic1 || !topic2 || !topic3) continue;

        const potentialVault = `0x${topic1.slice(-40)}`;
        // Third topic (index 2) is implementation
        const implementation = `0x${topic2.slice(-40)}`;
        // Fourth topic (index 3) is underlying asset (USDC)
        const underlying = `0x${topic3.slice(-40)}`;

        // Check if underlying is USDC
        if (underlying.toLowerCase() === "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913") {
          potentialVaults.push(potentialVault);
          console.log(`\n✅ Found Aave USDC vault in Log ${i + 1} (VaultDeployed event):`);
          console.log(`   Vault Address: ${potentialVault}`);
          console.log(`   Implementation: ${implementation}`);
          console.log(`   Underlying Asset: ${underlying} (USDC)`);
          console.log(`   Emitted by: ${log.address}`);
        }
      }
    }

    if (potentialVaults.length > 0) {
      console.log(`\n🎯 Most likely vault address: ${potentialVaults[0]}`);
      console.log(`\nVerifying vault...`);

      // Try to verify it's an ERC-4626 vault
      try {
        const asset = await publicClient.readContract({
          address: potentialVaults[0] as `0x${string}`,
          abi: [
            {
              inputs: [],
              name: "asset",
              outputs: [{ type: "address" }],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "asset",
        });

        if (asset.toLowerCase() === "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913") {
          console.log(`\n✅ VERIFIED! This is your Aave USDC vault!`);
          return potentialVaults[0];
        }
      } catch (error) {
        console.log(`\n⚠️  Could not verify vault (might still be valid): ${error}`);
      }
    }

    // If no vault found in events, show all potential addresses
    if (potentialVaults.length === 0) {
      console.log(`\n📝 All event logs:`);
      for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        if (log.topics.length > 1 && log.topics[1]) {
          const potentialAddr = `0x${log.topics[1].slice(-40)}`;
          console.log(`  Log ${i + 1}: ${log.address} -> Potential address: ${potentialAddr}`);
        }
      }
    }

    // Look for contract creations in internal transactions
    console.log("\n💡 To find the vault address:");
    console.log("1. Check the transaction on Basescan for 'Internal Transactions'");
    console.log("2. Look for a contract creation (CONTRACT CREATION)");
    console.log("3. The 'To' address in the internal transaction is your vault");
    console.log("\nOr check the event logs on Basescan for 'VaultCreated' events");

    return null;
  } catch (error) {
    console.error("Error fetching transaction:", error);
    throw error;
  }
}

getVaultAddress()
  .then((address) => {
    if (address) {
      console.log(`\n🎉 Vault Address: ${address}`);
      console.log(`\nView on Basescan: https://basescan.org/address/${address}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
