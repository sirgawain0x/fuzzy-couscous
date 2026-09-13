"use client";

import { useReadContract } from "wagmi";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import type { Address } from "viem";
import { CREATIVE_BANK_BOUNCER_ABI } from "@/lib/config/yearn";

type UseKalaniDepositEligibilityReturn = {
  isEligible: boolean;
  depositLimit: bigint | undefined;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Checks if the current user is allowed to deposit into the Kalani vault
 * via the Creative Bank Bouncer (Yearn V3 deposit limit module).
 * When bouncer address is not set, returns isEligible: true so UI relies on
 * PremiumGuard / membership context instead.
 */
export const useKalaniDepositEligibility = (
  bouncerAddress: Address | undefined
): UseKalaniDepositEligibilityReturn => {
  const { address: wagmiAddress } = useAccount();
  const { wallet: crossmintWallet } = useWallet();

  const userAddress = useMemo((): Address | undefined => {
    if (crossmintWallet?.address) {
      return crossmintWallet.address as Address;
    }
    return wagmiAddress ?? undefined;
  }, [crossmintWallet?.address, wagmiAddress]);

  const {
    data: depositLimit,
    isLoading,
    error,
  } = useReadContract({
    address: bouncerAddress,
    abi: CREATIVE_BANK_BOUNCER_ABI,
    functionName: "available_deposit_limit",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: Boolean(bouncerAddress && userAddress),
    },
  });

  const result = useMemo((): UseKalaniDepositEligibilityReturn => {
    if (!bouncerAddress) {
      return {
        isEligible: true,
        depositLimit: undefined,
        isLoading: false,
        error: null,
      };
    }
    if (isLoading || (depositLimit === undefined && !error)) {
      return {
        isEligible: false,
        depositLimit: undefined,
        isLoading: true,
        error: null,
      };
    }
    return {
      isEligible: depositLimit !== undefined && depositLimit > 0n,
      depositLimit,
      isLoading: false,
      error: error ?? null,
    };
  }, [bouncerAddress, depositLimit, isLoading, error]);

  return result;
};
