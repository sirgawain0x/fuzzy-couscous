import { Address } from "viem";

/**
 * Kalani Vault Deployment - Creative Bank on Base
 *
 * Project ID: 0xb549b5f4ad020a1591e9c449c758d5d1e6f0b84d62b3aa133a98be87f2b51a9b
 * Deployed: Yearn V3 compatible multi-strategy vault
 */

export const KALANI_VAULT_ADDRESSES = {
  // Factory and Infrastructure
  roleManagerFactory: "0xca12459a931643BF28388c67639b3F352fe9e5Ce" as Address,
  aprOracle: "0x1981AD9F44F2EA9aDd2dC4AD7D075c102C70aF92" as Address,
  addressProvider: "0x1e9778aAD41Aa3E0884C276fB4C2D03C4036Aa0B" as Address,

  // Creative Bank USDC Vault (cbUSDC)
  creativeBankVault: "0x882652a70f32Bb3606C357E2e314C63Eb1C29912" as Address,
  roleManager: "0xd3b7513ee10f63416b74254d76d0cb892fb70307" as Address,
  registry: "0x2aC025aE91dddcda3BB7D8EaB11efA3608dAF634" as Address,
  accountant: "0x928a31A7727e53CBE9f99fAb39eFb705c933093e" as Address,
  debtAllocator: "0xD1803ECCb53645D5bde0AE2FB1b55a2254fe358e" as Address,
} as const;

export const KALANI_CHAIN_ID = 8453;

/**
 * Yearn V3 USDC Allocator Vault on Base (official endorsed vault).
 * Use this address when integrating with the Yearn Registry or GOAT agent.
 * ERC-4626 compliant; underlying asset: USDC.
 */
export const YEARN_USDC_VAULT_BASE = "0xb13CF163d916917d9cD6E836905cA5f12a1dEF4B" as Address;

/** Fallback vault address when NEXT_PUBLIC_CREATIVE_BANK_YEARN_VAULT_ADDRESS is not set (legacy Kalani). */
const CREATIVE_BANK_VAULT_ADDRESS_FALLBACK =
  "0x882652a70f32Bb3606C357E2e314C63Eb1C29912" as Address;

/**
 * Creative Bank Vault Details (Yearn V3 USDC allocator on Base).
 * Set NEXT_PUBLIC_CREATIVE_BANK_YEARN_VAULT_ADDRESS to the vault that has
 * set_deposit_limit_module(bouncer) so the UI and on-chain gating match.
 */
export const CREATIVE_BANK_VAULT = {
  get address(): Address {
    const env = process.env.NEXT_PUBLIC_CREATIVE_BANK_YEARN_VAULT_ADDRESS;
    return (env as Address) || CREATIVE_BANK_VAULT_ADDRESS_FALLBACK;
  },
  name: "USDC Creative Bank",
  symbol: "cbUSDC",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address, // USDC
  assetName: "USD Coin",
  assetSymbol: "USDC",
  type: "Creative Bank Allocator", // Yearn V3 multi-strategy
} as const;

/**
 * Creative Bank Bouncer (Deposit Limit Module)
 * Set CREATIVE_BANK_BOUNCER_ADDRESS after deploying CreativeBankBouncer.sol
 * with (brandNFT, investorNFT, creatorNFT) = Creative Brand, Creative Investor, Creative Creator lock addresses.
 * Then call set_deposit_limit_module(bouncerAddress) on the Yearn vault.
 */
export const CREATIVE_BANK_BOUNCER_ADDRESS: Address | undefined = process.env
  .NEXT_PUBLIC_CREATIVE_BANK_BOUNCER_ADDRESS as Address | undefined;
