import { type Address } from "viem";

/**
 * Symbiotic Protocol Configuration
 * Restaking vaults on Ethereum Mainnet
 * Available to Investor and Brand tier members
 */

export const SYMBIOTIC_CHAIN_ID = 1; // Ethereum Mainnet

export interface SymbioticVaultConfig {
  address: Address;
  name: string;
  collateralSymbol: string;
  collateralAddress: Address;
  collateralDecimals: number;
  description: string;
  curator?: string;
}

// Symbiotic Default Collateral (DC) vault for sUSDe
// This is the stablecoin-adjacent restaking option
export const SYMBIOTIC_VAULTS: SymbioticVaultConfig[] = [
  {
    address: "0x19d0D8e6294B7a04a2733FE433444704B791939A",
    name: "Symbiotic sUSDe Restaking",
    collateralSymbol: "sUSDe",
    collateralAddress: "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497",
    collateralDecimals: 18,
    description:
      "Stake sUSDe into Symbiotic to earn restaking rewards from securing multiple networks. Provides economic security for cross-chain infrastructure.",
    curator: "Symbiotic",
  },
  {
    address: "0xC329400492c6ff2438472D4651Ad17389fCb843a",
    name: "Symbiotic wstETH Restaking",
    collateralSymbol: "wstETH",
    collateralAddress: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    collateralDecimals: 18,
    description:
      "Stake wstETH into Symbiotic to earn restaking rewards on top of Lido staking yield. Dual-layer yield from staking + network security.",
    curator: "Symbiotic",
  },
];

// Minimal ABI for Symbiotic Default Collateral vaults
// These follow an ERC-4626-like deposit/withdraw pattern
export const SYMBIOTIC_VAULT_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "burnedShares", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "asset",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

// Recommended minimum deposit to justify Ethereum mainnet gas costs
export const SYMBIOTIC_RECOMMENDED_MIN_USD = 2500;
