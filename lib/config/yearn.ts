import { Address } from "viem";

/**
 * Yearn V3 Protocol Addresses on Base Mainnet
 * These addresses are stable across all EVM chains where Yearn V3 is deployed
 */
export const YEARN_V3_ADDRESSES = {
  // Protocol Address Provider - top-level directory for all protocol contracts
  protocolAddressProvider: "0x775F09d6f3c8D2182DFA8bce8628acf51105653c" as Address,

  // Current V3 Registry - retrieve endorsed vaults
  registry: "0xd40ecF29e001c76Dcc4cC0D9cd50520CE845B038" as Address,

  // Role Manager (Ethereum Mainnet) - manages multi-strategy vaults
  // Note: This address may differ on Base, update if needed
  roleManager: "0x0000000000000000000000000000000000000000" as Address, // TODO: Update for Base
} as const;

/**
 * Base Chain ID for Yearn V3
 */
export const YEARN_CHAIN_ID = 8453; // Base Mainnet

/**
 * When Goldsky returns no deposit/withdraw rows, the hook falls back to RPC `getLogs` from this
 * block through latest (chunked). Set `NEXT_PUBLIC_YEARN_CASHFLOW_RPC_FROM_BLOCK` if scans miss
 * older history (must be before the user's first vault interaction).
 */
export const YEARN_CASHFLOW_RPC_FROM_BLOCK = BigInt(
  process.env.NEXT_PUBLIC_YEARN_CASHFLOW_RPC_FROM_BLOCK ?? "15000000"
);

/** Base mainnet contract URL for explorers. */
export const BASE_BLOCK_EXPLORER_ADDRESS_URL = "https://basescan.org/address" as const;

/**
 * Vault Categories
 * Category 1 vaults are generally the lowest risk and most similar to V2 style vaults
 */
export enum YearnVaultCategory {
  CONSERVATIVE = 1,
  MODERATE = 2,
  AGGRESSIVE = 3,
}

/**
 * ERC-4626 Vault ABI - Core functions for Yearn V3 interaction
 * All V3 vaults are fully ERC-4626 compliant
 */
export const ERC4626_ABI = [
  // View functions
  {
    inputs: [],
    name: "asset",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAssets",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "assets", type: "uint256" }],
    name: "convertToShares",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "shares", type: "uint256" }],
    name: "convertToAssets",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "receiver", type: "address" }],
    name: "maxDeposit",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "maxWithdraw",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "maxRedeem",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  // Deposit function (recommended over mint)
  {
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    name: "deposit",
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },

  // Redeem function (recommended over withdraw)
  // V3 adds optional maxLoss parameter (basis points)
  {
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
      { name: "maxLoss", type: "uint256" }, // Optional: defaults to 10000 (100%)
    ],
    name: "redeem",
    outputs: [{ name: "assets", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },

  // Standard redeem without maxLoss
  {
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    name: "redeem",
    outputs: [{ name: "assets", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },

  // Withdraw function with optional maxLoss
  {
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
      { name: "maxLoss", type: "uint256" }, // Optional: defaults to 0 (0%)
    ],
    name: "withdraw",
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Registry ABI - Functions to retrieve endorsed vaults
 */
export const YEARN_REGISTRY_ABI = [
  {
    inputs: [],
    name: "getAllEndorsedVaults",
    outputs: [
      {
        name: "",
        type: "address[][]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_asset", type: "address" }],
    name: "getEndorsedVaults",
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_vault", type: "address" }],
    name: "vaultInfo",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "asset", type: "address" },
          { name: "releaseVersion", type: "uint256" },
          { name: "vaultType", type: "uint256" }, // 1 = multi-strategy, 2 = single-strategy
          { name: "deploymentTimestamp", type: "uint256" },
          { name: "index", type: "uint256" },
          { name: "tag", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * ERC20 ABI for token approvals
 */
export const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
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
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Maximum loss in basis points (100% = 10000)
 * Used for withdrawal operations
 */
export const MAX_LOSS_BPS = {
  NONE: 0, // 0% loss allowed (default for withdraw)
  LOW: 100, // 1% loss allowed
  MEDIUM: 500, // 5% loss allowed
  HIGH: 1000, // 10% loss allowed
  UNLIMITED: 10000, // 100% loss allowed (default for redeem)
} as const;

/**
 * Helper to calculate maxLoss in basis points
 */
export const calculateMaxLossBps = (percentLoss: number): number => {
  return Math.floor(percentLoss * 100);
};

/**
 * USDC address on Base
 */
export const USDC_ADDRESS_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as Address;

/**
 * Creative Bank Bouncer v2 ABI (Yearn V3 deposit limit module).
 * Gates deposits behind membership NFTs AND enforces on-chain fee floor:
 *   - Members: 10% minimum (1000 BPS)
 *   - Non-members: 20% minimum (2000 BPS)
 */
export const CREATIVE_BANK_BOUNCER_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "available_deposit_limit",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isMember",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getMembershipTier",
    outputs: [{ name: "tier", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getMinFeeForUser",
    outputs: [{ name: "", type: "uint16" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "vault", type: "address" },
    ],
    name: "validateFee",
    outputs: [
      { name: "valid", type: "bool" },
      { name: "currentFee", type: "uint16" },
      { name: "requiredFee", type: "uint16" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
