"use client";

import { useCallback, useMemo } from "react";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { stringToHex } from "viem";
import {
  NEXUS_COVER_BROKER_ADDRESS,
  NEXUS_COVER_CHAIN_ID,
  COVER_BROKER_ABI,
  toBigIntSafe,
} from "@/lib/config/nexus-mutual";
import type {
  NexusQuoteResult,
  NexusBuyCoverParams,
  NexusPoolAllocationRequest,
} from "./useNexusCoverQuote";

/**
 * Converts IPFS CID or hex string to bytes for CoverBroker.buyCover ipfsData.
 * Single-protocol cover (Aave v3, Yearn v3) does not require IPFS content; pass 0x.
 */
function ipfsDataToBytes(ipfsData?: string): `0x${string}` {
  if (!ipfsData || ipfsData === "0x") return "0x";
  if (ipfsData.startsWith("0x")) return ipfsData as `0x${string}`;
  try {
    return stringToHex(ipfsData) as `0x${string}`;
  } catch {
    return "0x";
  }
}

/**
 * Convert quote API response to contract args.
 * commissionRatio from API is 0-1 (e.g. 0.1); contract uses basis points (10000 = 100%).
 */
function quoteToContractArgs(quote: NexusQuoteResult): [
  {
    productId: bigint;
    coverId: bigint;
    owner: `0x${string}`;
    coverAsset: bigint;
    period: bigint;
    amount: bigint;
    commissionRatio: number;
    paymentAsset: bigint;
    maxPremiumInAsset: bigint;
    commissionDestination: `0x${string}`;
    ipfsData: `0x${string}`;
  },
  Array<{ poolId: bigint; coverAmountInAsset: bigint; skip: boolean }>,
] {
  const p: NexusBuyCoverParams = quote.buyCoverInput.buyCoverParams;
  const coverAssetNum =
    typeof p.coverAsset === "string"
      ? ["ETH", "DAI", "USDC", "cbBTC"].indexOf(p.coverAsset) >= 0
        ? ["ETH", "DAI", "USDC", "cbBTC"].indexOf(p.coverAsset)
        : 0
      : p.coverAsset;
  const commissionBps = Math.round((p.commissionRatio ?? 0) * 10000);

  const params = {
    productId: toBigIntSafe(p.productId),
    coverId: toBigIntSafe(p.coverId ?? 0),
    owner: p.owner as `0x${string}`,
    coverAsset: toBigIntSafe(coverAssetNum),
    period: toBigIntSafe(p.period),
    amount: toBigIntSafe(p.amount),
    commissionRatio: commissionBps,
    paymentAsset: toBigIntSafe(p.paymentAsset ?? coverAssetNum),
    maxPremiumInAsset: toBigIntSafe(p.maxPremiumInAsset),
    commissionDestination: (p.commissionDestination ??
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
    ipfsData: ipfsDataToBytes(p.ipfsData),
  };

  const poolRequests: Array<{ poolId: bigint; coverAmountInAsset: bigint; skip: boolean }> =
    quote.buyCoverInput.poolAllocationRequests.map((r: NexusPoolAllocationRequest) => ({
      poolId: toBigIntSafe(r.poolId),
      coverAmountInAsset: toBigIntSafe(r.coverAmountInAsset),
      skip: r.skip ?? false,
    }));

  return [params, poolRequests];
}

type UseNexusBuyCoverParams = {
  quote: NexusQuoteResult | null;
  enabled?: boolean;
};

type UseNexusBuyCoverReturn = {
  buyCover: (() => void) | undefined;
  isPending: boolean;
  isSuccess: boolean;
  txHash?: `0x${string}`;
  error: Error | null;
  reset: () => void;
  isCorrectChain: boolean;
  switchToEthereum: () => void;
};

/**
 * Executes Nexus Mutual buyCover on Ethereum mainnet using quote from useNexusCoverQuote.
 * User must be on chain 1 (Ethereum) to sign; use switchToEthereum() when on Base.
 */
export function useNexusBuyCover({
  quote,
  enabled = true,
}: UseNexusBuyCoverParams): UseNexusBuyCoverReturn {
  const { address, chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const [params, poolRequests] = useMemo(() => {
    if (!quote) return [null, null];
    try {
      const [p, pr] = quoteToContractArgs(quote);
      return [p, pr] as const;
    } catch {
      return [null, null];
    }
  }, [quote]);

  const isCorrectChain = chain?.id === NEXUS_COVER_CHAIN_ID;

  const {
    writeContract,
    isPending,
    isSuccess,
    data: txHash,
    error: writeError,
    reset,
  } = useWriteContract({
    mutation: {
      onError: () => {},
    },
  });

  const switchToEthereum = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: NEXUS_COVER_CHAIN_ID });
    } catch (e) {
      console.error("Failed to switch to Ethereum:", e);
    }
  }, [switchChainAsync]);

  const buyCover = useCallback(() => {
    if (!enabled || !quote || !params || !poolRequests || !address) return;
    if (!isCorrectChain) {
      switchToEthereum();
      return;
    }
    writeContract({
      address: NEXUS_COVER_BROKER_ADDRESS,
      abi: COVER_BROKER_ABI,
      functionName: "buyCover",
      args: [params, poolRequests],
      chainId: NEXUS_COVER_CHAIN_ID,
      value:
        quote.buyCoverInput.buyCoverParams.paymentAsset === 0
          ? toBigIntSafe(quote.buyCoverInput.buyCoverParams.maxPremiumInAsset)
          : 0n,
    });
  }, [
    enabled,
    quote,
    params,
    poolRequests,
    address,
    isCorrectChain,
    switchToEthereum,
    writeContract,
  ]);

  return {
    buyCover: params && poolRequests ? buyCover : undefined,
    isPending,
    isSuccess,
    txHash,
    error: writeError ?? null,
    reset,
    isCorrectChain,
    switchToEthereum,
  };
}
