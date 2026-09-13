"use client";

import { useState, useCallback, useEffect } from "react";
import type { Address } from "viem";
import {
  NEXUS_MIN_COVER_PERIOD_DAYS,
  NEXUS_MAX_COVER_PERIOD_DAYS,
  type NexusCoverAssetId,
} from "@/lib/config/nexus-mutual";

export type NexusQuoteDisplayInfo = {
  premiumInAsset: string;
  coverAmount: string;
  yearlyCostPerc: number;
  maxCapacity: string;
};

export type NexusBuyCoverParams = {
  coverId: number;
  owner: Address;
  productId: number;
  coverAsset: number | string;
  amount: string;
  period: number;
  maxPremiumInAsset: string;
  paymentAsset: number;
  commissionRatio: number;
  commissionDestination?: Address;
  ipfsData?: string;
};

export type NexusPoolAllocationRequest = {
  poolId: string;
  coverAmountInAsset: string;
  skip: boolean;
};

export type NexusQuoteResult = {
  displayInfo: NexusQuoteDisplayInfo;
  buyCoverInput: {
    buyCoverParams: NexusBuyCoverParams;
    poolAllocationRequests: NexusPoolAllocationRequest[];
  };
};

type UseNexusCoverQuoteParams = {
  productId: number;
  amountWei: string;
  periodDays: number;
  coverAsset: NexusCoverAssetId;
  buyerAddress: Address | undefined;
  enabled?: boolean;
};

type UseNexusCoverQuoteReturn = {
  result: NexusQuoteResult | null;
  error: { message: string; data?: unknown } | null;
  loading: boolean;
  refetch: () => void;
};

/**
 * Fetches a Nexus Mutual cover quote via @nexusmutual/sdk.
 * Quote is fetched from Nexus API; no chain required. Cover purchase is on Ethereum mainnet.
 */
export function useNexusCoverQuote({
  productId,
  amountWei,
  periodDays,
  coverAsset,
  buyerAddress,
  enabled = true,
}: UseNexusCoverQuoteParams): UseNexusCoverQuoteReturn {
  const [result, setResult] = useState<NexusQuoteResult | null>(null);
  const [error, setError] = useState<{ message: string; data?: unknown } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQuote = useCallback(async () => {
    if (
      !enabled ||
      !buyerAddress ||
      !amountWei ||
      BigInt(amountWei) <= 0n ||
      periodDays < NEXUS_MIN_COVER_PERIOD_DAYS ||
      periodDays > NEXUS_MAX_COVER_PERIOD_DAYS
    ) {
      setResult(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const sdk = await import("@nexusmutual/sdk");
      const nexusSdk = new sdk.NexusSDK();
      const coverAssetEnum =
        coverAsset === 0
          ? sdk.CoverAsset.ETH
          : coverAsset === 2
            ? sdk.CoverAsset.USDC
            : coverAsset === 3
              ? sdk.CoverAsset.cbBTC
              : sdk.CoverAsset.DAI;

      const commissionDestination = process.env.NEXT_PUBLIC_NEXUS_MUTUAL_DESTINATION_ADDRESS as
        | Address
        | undefined;
      const commissionRatio = 0.2; // 20%

      const response = await nexusSdk.quote.getQuoteAndBuyCoverInputs({
        productId,
        amount: amountWei,
        period: periodDays,
        coverAsset: coverAssetEnum,
        buyerAddress,
        paymentAsset: coverAssetEnum,
        ...(commissionDestination && /^0x[a-fA-F0-9]{40}$/.test(commissionDestination)
          ? { commissionRatio, commissionDestination }
          : {}),
      });

      if (response.result) {
        setResult(response.result as NexusQuoteResult);
        setError(null);
      } else if (response.error) {
        setError({
          message: (response.error as { message?: string }).message ?? "Failed to get quote",
          data: (response.error as { data?: unknown }).data,
        });
        setResult(null);
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError({ message: err.message });
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, buyerAddress, amountWei, periodDays, coverAsset, productId]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  return { result, error, loading, refetch: fetchQuote };
}
