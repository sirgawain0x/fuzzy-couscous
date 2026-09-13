/**
 * Nexus Mutual cover integration config.
 * Cover is purchased on Ethereum mainnet; policy protects positions on Base.
 * @see https://docs.nexusmutual.io/developers/pos-integrations
 */

import type { Address } from "viem";

/** Product ID for Aave v3 (Single Protocol Cover). Protects Aave v3 / Aave Earn positions on Base. */
export const NEXUS_AAVE_V3_PRODUCT_ID = 97;

/** Product ID for Yearn v3 (Single Protocol Cover). Use 141 for Bundled/Multi-Protocol if preferred. */
export const NEXUS_YEARN_V3_PRODUCT_ID = 123;

/** Chain where CoverBroker lives; user must sign the buyCover tx on this chain. */
export const NEXUS_COVER_CHAIN_ID = 1;

/** CoverBroker contract on Ethereum mainnet (from @nexusmutual/sdk addresses). */
export const NEXUS_COVER_BROKER_ADDRESS: Address = "0xCB2B736652D2dBf7d72e4dB880Cf6B7d99507814";

/** Min cover period in days (Nexus Mutual). */
export const NEXUS_MIN_COVER_PERIOD_DAYS = 28;

/** Max cover period in days (Nexus Mutual). */
export const NEXUS_MAX_COVER_PERIOD_DAYS = 365;

/** Min cover amount in USD (from products.json minPrice). */
export const NEXUS_MIN_COVER_USD = 100;

/**
 * Safely coerce a value (which may be a number, decimal string, or integer
 * string) into a BigInt of base units. The Nexus SDK occasionally returns
 * fractional values (e.g. 9999.8) for premium/amount fields; calling BigInt()
 * directly on those throws "cannot be converted to a BigInt". We floor the
 * value to the nearest integer to keep the flow resilient.
 */
export function toBigIntSafe(value: string | number | bigint | undefined | null): bigint {
  if (value == null) return 0n;
  if (typeof value === "bigint") return value;
  // Numbers must be handled before String(): large wei values (>= 1e21)
  // stringify to scientific notation (e.g. "1e+21"), which BigInt() rejects.
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.floor(value));
  }
  const str = value.trim();
  if (str === "") return 0n;
  // Drop any fractional component: base units must be integers.
  const integerPart = str.split(".")[0];
  try {
    return BigInt(integerPart === "" || integerPart === "-" ? "0" : integerPart);
  } catch {
    return 0n;
  }
}

/**
 * CoverAsset enum values used by Nexus Mutual API/contracts.
 * Align with Pool.getAssets / SDK CoverAsset.
 */
export const NEXUS_COVER_ASSET = {
  ETH: 0,
  DAI: 1,
  USDC: 2,
  cbBTC: 3,
} as const;

export type NexusCoverAssetId = (typeof NEXUS_COVER_ASSET)[keyof typeof NEXUS_COVER_ASSET];

/** Map our asset symbol to Nexus cover asset id for quote/buy. */
export function getNexusCoverAssetId(assetSymbol: string): NexusCoverAssetId {
  const u = assetSymbol.toUpperCase();
  if (u === "ETH") return NEXUS_COVER_ASSET.ETH;
  if (u === "DAI") return NEXUS_COVER_ASSET.DAI;
  if (u === "USDC" || u === "USDT") return NEXUS_COVER_ASSET.USDC;
  if (u === "CBBTC") return NEXUS_COVER_ASSET.cbBTC;
  return NEXUS_COVER_ASSET.USDC;
}

/**
 * Minimal CoverBroker ABI for buyCover.
 * Full ABI available from @nexusmutual/sdk (abis.CoverBroker).
 */
export const COVER_BROKER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "productId", type: "uint256" },
          { name: "coverId", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "coverAsset", type: "uint256" },
          { name: "period", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "commissionRatio", type: "uint16" },
          { name: "paymentAsset", type: "uint256" },
          { name: "maxPremiumInAsset", type: "uint256" },
          { name: "commissionDestination", type: "address" },
          { name: "ipfsData", type: "bytes" },
        ],
        name: "params",
        type: "tuple",
      },
      {
        components: [
          { name: "poolId", type: "uint256" },
          { name: "coverAmountInAsset", type: "uint256" },
          { name: "skip", type: "bool" },
        ],
        name: "poolAllocationRequests",
        type: "tuple[]",
      },
    ],
    name: "buyCover",
    outputs: [{ name: "coverId", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

/** Links for PoS required disclaimers. */
export const NEXUS_TERMS_LINKS = {
  singleProtocol: "https://docs.nexusmutual.io/overview/cover-products/protocol-cover",
  bundledProtocol: "https://docs.nexusmutual.io/overview/cover-products/bundled-protocol-cover",
  conditions: "https://docs.nexusmutual.io/overview/cover-products",
  restrictedCountries: "https://nexusmutual.io/restricted-countries",
} as const;
