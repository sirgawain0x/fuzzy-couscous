/**
 * RHJ `/prices` bid/ask are raw underlier equity prices (not multiplier-adjusted).
 * Token-equivalent USD ≈ rawPrice * currentMultiplier (multiplier is a decimal string).
 */
export const applyMultiplierToPrice = (
  rawPrice: string | undefined,
  currentMultiplier: string | undefined
): string | undefined => {
  if (!rawPrice) return undefined;
  const price = Number(rawPrice);
  const multiplier = Number(currentMultiplier ?? "1");
  if (!Number.isFinite(price) || !Number.isFinite(multiplier)) return undefined;
  return (price * multiplier).toString();
};

/**
 * Underlying share-equivalent for a raw ERC-20 stock token amount.
 * Formula: shares = rawAmount * uiMultiplier / 1e18
 * When multiplier is already a human decimal (from RHJ `/assets`), use:
 * shares = rawHumanAmount * currentMultiplier
 */
export const rawAmountToShares = (
  rawHumanAmount: string,
  currentMultiplier: string | undefined
): string | undefined => {
  const amount = Number(rawHumanAmount);
  const multiplier = Number(currentMultiplier ?? "1");
  if (!Number.isFinite(amount) || !Number.isFinite(multiplier)) return undefined;
  return (amount * multiplier).toString();
};

export const formatUsdDisplay = (value: string | undefined, digits = 2): string => {
  if (!value) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const isLikelyUntradable = (fractionalTradability: string | null | undefined): boolean => {
  if (!fractionalTradability) return false;
  return fractionalTradability === "untradable";
};
