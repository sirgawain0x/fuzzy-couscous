import { Address } from "viem";

/**
 * Creative Bank Multi-Strategy Vault Configuration
 *
 * This vault allocates USDC across 4 Tokenized Strategies:
 * - Aave V3: Lending on Aave Protocol
 * - Compound V3: Lending on Compound Protocol
 * - Curve: Liquidity provision to Curve 3pool
 * - Spark: Lending on Spark Protocol
 */

export const MULTI_STRATEGY_VAULT = {
  // Vault address (will be set after deployment)
  vaultAddress: "0x0000000000000000000000000000000000000000" as Address,

  // Strategy addresses (will be set after deployment)
  strategies: {
    aave: "0x0000000000000000000000000000000000000000" as Address,
    compound: "0x0000000000000000000000000000000000000000" as Address,
    curve: "0x0000000000000000000000000000000000000000" as Address,
    spark: "0x0000000000000000000000000000000000000000" as Address,
  },

  // Vault metadata
  name: "Creative Bank Multi-Strategy USDC",
  symbol: "cbUSDC-v2",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address, // USDC
  assetName: "USD Coin",
  assetSymbol: "USDC",
  assetDecimals: 6,

  // Strategy allocation (can be adjusted via vault management)
  allocation: {
    aave: 25, // 25% allocation
    compound: 25,
    curve: 25,
    spark: 25,
  },

  // Network
  chainId: 8453, // Base
} as const;

/**
 * Yearn V3 Infrastructure addresses for Base
 */
export const YEARN_V3_INFRASTRUCTURE = {
  roleManagerFactory: "0xca12459a931643BF28388c67639b3F352fe9e5Ce" as Address,
  protocolAddressProvider: "0x775F09d6f3c8D2182DFA8bce8628acf51105653c" as Address,
  tokenizedStrategy: "0xD377919FA87120584B21279a491F82D5265A139c" as Address, // Version 3.0.4
} as const;
