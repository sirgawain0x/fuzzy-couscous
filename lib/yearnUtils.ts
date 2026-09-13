import { formatUnits, parseUnits } from "viem";

/**
 * Utility functions for Yearn V3 ERC-4626 vault interactions
 * These functions help with pricing, conversion, and formatting
 */

/**
 * Convert vault shares to underlying asset amount
 * Uses the vault's convertToAssets function result
 */
export const sharesToAssets = (
  shares: bigint,
  totalShares: bigint,
  totalAssets: bigint,
  decimals: number = 18
): string => {
  if (totalShares === 0n) {
    return "0";
  }

  const assets = (shares * totalAssets) / totalShares;
  return formatUnits(assets, decimals);
};

/**
 * Convert underlying asset amount to vault shares
 * Uses the vault's convertToShares function result
 */
export const assetsToShares = (
  assets: bigint,
  totalShares: bigint,
  totalAssets: bigint,
  decimals: number = 18
): string => {
  if (totalAssets === 0n) {
    return "0";
  }

  const shares = (assets * totalShares) / totalAssets;
  return formatUnits(shares, decimals);
};

/**
 * Calculate the price per share (share value in underlying asset)
 * This is equivalent to convertToAssets(1 share)
 */
export const calculatePricePerShare = (
  totalAssets: bigint,
  totalShares: bigint,
  decimals: number = 18
): string => {
  if (totalShares === 0n) {
    return "1.0";
  }

  const oneShare = parseUnits("1", decimals);
  const pricePerShare = (oneShare * totalAssets) / totalShares;
  return formatUnits(pricePerShare, decimals);
};

/**
 * Calculate APY from APR (Annual Percentage Rate)
 * Assumes daily compounding
 */
export const aprToApy = (apr: number, compoundingPeriodsPerYear: number = 365): number => {
  return (Math.pow(1 + apr / compoundingPeriodsPerYear, compoundingPeriodsPerYear) - 1) * 100;
};

/**
 * Format vault share balance with proper decimals
 */
export const formatVaultShares = (shares: bigint, decimals: number = 18): string => {
  const formatted = formatUnits(shares, decimals);
  const num = parseFloat(formatted);

  if (num === 0) {
    return "0";
  }

  // For very small numbers, show more precision instead of scientific notation
  if (num < 0.000001) {
    // Show up to 12 decimal places for very small numbers
    const fixed = num.toFixed(12);
    // Remove trailing zeros
    return fixed.replace(/\.?0+$/, "");
  }

  if (num < 1) {
    // For numbers between 0.000001 and 1, show 6 decimal places
    return num.toFixed(6).replace(/\.?0+$/, "");
  }

  // For numbers >= 1, use locale formatting with 2-6 decimal places
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
};

/**
 * Format USD value
 */
export const formatUsdValue = (value: number): string => {
  if (value === 0) {
    return "$0.00";
  }

  if (value < 0.01) {
    return "<$0.01";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Calculate the maximum loss percentage from basis points
 */
export const maxLossBpsToPercent = (bps: number): number => {
  return bps / 100;
};

/**
 * Convert percentage to basis points
 */
export const percentToMaxLossBps = (percent: number): number => {
  return Math.floor(percent * 100);
};

/**
 * Validate max loss input (must be between 0 and 100)
 */
export const validateMaxLoss = (maxLoss: number): boolean => {
  return maxLoss >= 0 && maxLoss <= 100;
};

/**
 * Parse user input amount to bigint with proper decimals
 */
export const parseInputAmount = (input: string, decimals: number = 18): bigint | null => {
  try {
    if (!input || input.trim() === "") {
      return null;
    }

    const cleanedInput = input.replace(/,/g, "");

    if (!/^\d*\.?\d*$/.test(cleanedInput)) {
      return null;
    }

    return parseUnits(cleanedInput, decimals);
  } catch {
    return null;
  }
};

/**
 * Calculate expected shares from deposit amount
 */
export const calculateExpectedShares = (
  depositAmount: bigint,
  totalAssets: bigint,
  totalShares: bigint
): bigint => {
  if (totalAssets === 0n || totalShares === 0n) {
    return depositAmount; // 1:1 ratio for first deposit
  }

  return (depositAmount * totalShares) / totalAssets;
};

/**
 * Calculate expected assets from redeem amount
 */
export const calculateExpectedAssets = (
  redeemShares: bigint,
  totalAssets: bigint,
  totalShares: bigint
): bigint => {
  if (totalShares === 0n) {
    return 0n;
  }

  return (redeemShares * totalAssets) / totalShares;
};

/**
 * Calculate slippage percentage
 */
export const calculateSlippage = (expected: bigint, actual: bigint): number => {
  if (expected === 0n) {
    return 0;
  }

  const diff = expected > actual ? expected - actual : actual - expected;
  return Number((diff * 10000n) / expected) / 100;
};

/**
 * Format percentage with optional fallback text
 */
export const formatPercentage = (value: number | undefined, fallback: string = "—"): string => {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return `${value.toFixed(2)}%`;
};

/**
 * Truncate address for display
 */
export const truncateAddress = (
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string => {
  if (address.length <= startChars + endChars) {
    return address;
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Check if withdrawal will incur loss based on maxLoss setting
 */
export const willIncurLoss = (
  expectedAssets: bigint,
  actualAssets: bigint,
  maxLossBps: number
): boolean => {
  if (expectedAssets === 0n) {
    return false;
  }

  const lossBps = ((expectedAssets - actualAssets) * 10000n) / expectedAssets;
  return lossBps > BigInt(maxLossBps);
};
