"use client";

import { useReadContract } from "wagmi";
import { Address } from "viem";
import { YEARN_V3_ADDRESSES, YEARN_REGISTRY_ABI, USDC_ADDRESS_BASE } from "@/lib/config/yearn";

/**
 * Hook to fetch all endorsed Yearn V3 vaults for a specific asset from the registry
 *
 * @param assetAddress - The underlying asset address (e.g., USDC)
 * @returns Array of vault addresses endorsed by Yearn
 *
 * @example
 * const { vaultAddresses, isLoading, error } = useYearnRegistry(USDC_ADDRESS_BASE);
 * // Returns: ["0xVault1...", "0xVault2...", ...]
 */
export const useYearnRegistry = (assetAddress: Address = USDC_ADDRESS_BASE) => {
  const {
    data: vaultAddresses,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: YEARN_V3_ADDRESSES.registry,
    abi: YEARN_REGISTRY_ABI,
    functionName: "getEndorsedVaults",
    args: [assetAddress],
    chainId: 8453, // Base mainnet
    query: {
      // Cache for 5 minutes as endorsed vaults don't change frequently
      staleTime: 5 * 60 * 1000,
    },
  });

  return {
    vaultAddresses: (vaultAddresses as Address[]) ?? [],
    isLoading,
    error: error ? (error as Error) : null,
    refetch,
  };
};

/**
 * Hook to fetch vault information from the registry
 *
 * @param vaultAddress - The vault address to query
 * @returns Vault info including asset, version, type, etc.
 */
export const useYearnVaultInfo = (vaultAddress: Address | undefined) => {
  const {
    data: vaultInfo,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: YEARN_V3_ADDRESSES.registry,
    abi: YEARN_REGISTRY_ABI,
    functionName: "vaultInfo",
    args: vaultAddress ? [vaultAddress] : undefined,
    chainId: 8453,
    query: {
      enabled: !!vaultAddress,
      staleTime: 5 * 60 * 1000,
    },
  });

  return {
    vaultInfo: vaultInfo as
      | {
          asset: Address;
          releaseVersion: bigint;
          vaultType: bigint; // 1 = multi-strategy, 2 = single-strategy
          deploymentTimestamp: bigint;
          index: bigint;
          tag: string;
        }
      | undefined,
    isLoading,
    error: error ? (error as Error) : null,
    refetch,
  };
};

/**
 * Hook to fetch all endorsed vaults across all assets
 * Note: This returns a nested array structure
 *
 * @returns Nested array of all endorsed vaults
 */
export const useAllYearnVaults = () => {
  const {
    data: allVaults,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: YEARN_V3_ADDRESSES.registry,
    abi: YEARN_REGISTRY_ABI,
    functionName: "getAllEndorsedVaults",
    chainId: 8453,
    query: {
      staleTime: 5 * 60 * 1000,
    },
  });

  return {
    allVaults: (allVaults as Address[][]) ?? [],
    isLoading,
    error: error ? (error as Error) : null,
    refetch,
  };
};
