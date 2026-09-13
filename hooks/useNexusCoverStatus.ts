"use client";

import { useState, useEffect, useCallback } from "react";

interface CoverStatus {
  hasCover: boolean;
  coverAmount?: string;
  expiresAt?: number;
  isLoading: boolean;
}

/**
 * Checks if a user has active Nexus Mutual cover for a specific product.
 * Queries the Nexus Mutual API for active covers by buyer address.
 *
 * Note: Nexus Mutual has a 14-day cooling period after purchase before
 * claims can be filed. The cover is still "active" during this period.
 */
export function useNexusCoverStatus(productId: number, buyerAddress?: string): CoverStatus {
  const [status, setStatus] = useState<CoverStatus>({
    hasCover: false,
    isLoading: true,
  });

  const checkCover = useCallback(async () => {
    if (!buyerAddress) {
      setStatus({ hasCover: false, isLoading: false });
      return;
    }

    try {
      // Query Nexus Mutual API for active covers
      const response = await fetch(`https://api.nexusmutual.io/v2/covers?buyer=${buyerAddress}`);

      if (!response.ok) {
        setStatus({ hasCover: false, isLoading: false });
        return;
      }

      const data = await response.json();
      const covers = data?.covers || data || [];

      // Find active cover for this product
      const now = Math.floor(Date.now() / 1000);
      const activeCover = Array.isArray(covers)
        ? covers.find(
            (cover: any) =>
              cover.productId === productId && cover.expiry > now && cover.status !== "expired"
          )
        : null;

      if (activeCover) {
        setStatus({
          hasCover: true,
          coverAmount: activeCover.amount,
          expiresAt: activeCover.expiry * 1000, // Convert to ms
          isLoading: false,
        });
      } else {
        setStatus({ hasCover: false, isLoading: false });
      }
    } catch (error) {
      console.warn("Failed to check Nexus cover status:", error);
      setStatus({ hasCover: false, isLoading: false });
    }
  }, [productId, buyerAddress]);

  useEffect(() => {
    checkCover();
  }, [checkCover]);

  return status;
}
