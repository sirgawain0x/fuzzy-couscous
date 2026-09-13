const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

/** Coinbase requires phone re-verification within 60 days for warm-start. */
export const isVerificationFresh = (verifiedAt?: string | null): boolean => {
  if (!verifiedAt) return false;
  const verifiedMs = new Date(verifiedAt).getTime();
  if (Number.isNaN(verifiedMs)) return false;
  return Date.now() - verifiedMs < SIXTY_DAYS_MS;
};
