"use client";

import { useEffect, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { Address } from "viem";
import {
  YEARN_V3_ADDRESSES,
  YEARN_REGISTRY_ABI,
  ERC4626_ABI,
  USDC_ADDRESS_BASE,
} from "@/lib/config/yearn";

export type VaultInfo = {
  address: Address;
  asset: Address;
  releaseVersion: bigint;
  vaultType: bigint; // 1 = multi-strategy, 2 = single-strategy
  deploymentTimestamp: bigint;
  index: bigint;
  tag: string;
};

export type VaultData = {
  address: Address;
  info: VaultInfo;
  totalAssets: bigint;
  totalShares: bigint;
  assetSymbol: string;
  pricePerShare: bigint;
};

type UseYearnVaultsReturn = {
  vaults: VaultData[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

/**
 * Hook to fetch all endorsed Yearn V3 vaults for a specific asset
 * Uses the Yearn Registry to get vault addresses and info
 */
export const useYearnVaults = (assetAddress: Address = USDC_ADDRESS_BASE): UseYearnVaultsReturn => {
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Get endorsed vault addresses for the asset
  const {
    data: vaultAddresses,
    isLoading: isLoadingAddresses,
    error: addressesError,
    refetch: refetchAddresses,
  } = useReadContract({
    address: YEARN_V3_ADDRESSES.registry,
    abi: YEARN_REGISTRY_ABI,
    functionName: "getEndorsedVaults",
    args: [assetAddress],
    chainId: 8453, // Base mainnet
  });

  useEffect(() => {
    const fetchVaultDetails = async () => {
      if (!vaultAddresses || vaultAddresses.length === 0) {
        setVaults([]);
        return;
      }

      setIsLoadingDetails(true);
      setError(null);

      try {
        // Create contract calls for each vault to get details
        const vaultCalls = (vaultAddresses as Address[]).flatMap((vaultAddress) => [
          {
            address: YEARN_V3_ADDRESSES.registry,
            abi: YEARN_REGISTRY_ABI,
            functionName: "vaultInfo" as const,
            args: [vaultAddress],
          },
          {
            address: vaultAddress,
            abi: ERC4626_ABI,
            functionName: "totalAssets" as const,
          },
          {
            address: vaultAddress,
            abi: ERC4626_ABI,
            functionName: "convertToAssets" as const,
            args: [BigInt(1e18)], // 1 share
          },
        ]);

        // Note: In a real implementation, you would use useReadContracts here
        // For now, we'll create placeholder data structure
        const vaultData: VaultData[] = [];

        setVaults(vaultData);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchVaultDetails();
  }, [vaultAddresses]);

  useEffect(() => {
    if (addressesError) {
      setError(addressesError as Error);
    }
  }, [addressesError]);

  return {
    vaults,
    isLoading: isLoadingAddresses || isLoadingDetails,
    error,
    refetch: refetchAddresses,
  };
};

/**
 * Hook to get details about a specific Yearn V3 vault
 */
export const useYearnVault = (vaultAddress: Address | undefined) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "totalAssets",
    chainId: 8453,
    query: {
      enabled: !!vaultAddress,
    },
  });

  const { data: assetAddress } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "asset",
    chainId: 8453,
    query: {
      enabled: !!vaultAddress,
    },
  });

  const { data: vaultInfo } = useReadContract({
    address: YEARN_V3_ADDRESSES.registry,
    abi: YEARN_REGISTRY_ABI,
    functionName: "vaultInfo",
    args: vaultAddress ? [vaultAddress] : undefined,
    chainId: 8453,
    query: {
      enabled: !!vaultAddress,
    },
  });

  const refetch = () => {
    refetchTotalAssets();
  };

  return {
    totalAssets: totalAssets as bigint | undefined,
    assetAddress: assetAddress as Address | undefined,
    vaultInfo: vaultInfo as VaultInfo | undefined,
    isLoading,
    error,
    refetch,
  };
};

/**
 * Hook to get user's vault share balance and asset value
 */
export const useYearnVaultBalance = (
  vaultAddress: Address | undefined,
  userAddress: Address | undefined
) => {
  const { data: shareBalance, refetch: refetchShares } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    chainId: 8453,
    query: {
      enabled: !!vaultAddress && !!userAddress,
    },
  });

  const { data: assetValue, refetch: refetchValue } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "convertToAssets",
    args: shareBalance ? [shareBalance as bigint] : undefined,
    chainId: 8453,
    query: {
      enabled: !!vaultAddress && !!shareBalance && shareBalance !== 0n,
    },
  });

  const { data: maxRedeem } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "maxRedeem",
    args: userAddress ? [userAddress] : undefined,
    chainId: 8453,
    query: {
      enabled: !!vaultAddress && !!userAddress,
    },
  });

  const refetch = () => {
    // Note: wagmi refetch() returns a promise, but the existing callers
    // (e.g. deposit/withdraw modals) don't require awaiting.
    // Interest tracking uses the returned values.
    return Promise.all([refetchShares(), refetchValue()]).then(([sharesRes, valueRes]) => {
      const sharesData = (sharesRes as { data?: unknown } | undefined)?.data;
      const valueData = (valueRes as { data?: unknown } | undefined)?.data;
      return {
        shareBalance: sharesData as bigint | undefined,
        assetValue: valueData as bigint | undefined,
      };
    });
  };

  return {
    shareBalance: shareBalance as bigint | undefined,
    assetValue: assetValue as bigint | undefined,
    maxRedeem: maxRedeem as bigint | undefined,
    refetch,
  };
};

/**
 * Hook to get maximum deposit amount for a vault
 */
export const useMaxDeposit = (
  vaultAddress: Address | undefined,
  userAddress: Address | undefined
) => {
  const { data: maxDeposit, refetch } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "maxDeposit",
    args: userAddress ? [userAddress] : undefined,
    chainId: 8453,
    query: {
      enabled: !!vaultAddress && !!userAddress,
    },
  });

  return {
    maxDeposit: maxDeposit as bigint | undefined,
    refetch,
  };
};

/**
 * Hook to preview deposit (get expected shares)
 */
export const usePreviewDeposit = (
  vaultAddress: Address | undefined,
  assets: bigint | undefined
) => {
  const { data: expectedShares, refetch } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "convertToShares",
    args: assets ? [assets] : undefined,
    chainId: 8453,
    query: {
      enabled: !!vaultAddress && !!assets && assets > 0n,
    },
  });

  return {
    expectedShares: expectedShares as bigint | undefined,
    refetch,
  };
};

/**
 * Hook to preview withdrawal (get expected assets)
 */
export const usePreviewRedeem = (vaultAddress: Address | undefined, shares: bigint | undefined) => {
  const { data: expectedAssets, refetch } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "convertToAssets",
    args: shares ? [shares] : undefined,
    chainId: 8453,
    query: {
      enabled: !!vaultAddress && !!shares && shares > 0n,
    },
  });

  return {
    expectedAssets: expectedAssets as bigint | undefined,
    refetch,
  };
};
