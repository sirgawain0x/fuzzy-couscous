"use client";

import { useMemo } from "react";
import {
  useUserVaults,
  evmAddress,
  PageSize,
  OrderDirection,
  type Vault,
  type PaginatedVaultsResult,
} from "@aave/react";

type UseUserVaultPositionsResult = {
  vaults: Vault[];
  loading: boolean;
  error: Error | undefined;
  pageInfo: PaginatedVaultsResult["pageInfo"] | undefined;
};

/**
 * Fetches Aave Earn vaults that the user has shares in (positions).
 * Uses userVaults({ user, orderBy: { shares: Desc }, pageSize }).
 */
export function useUserVaultPositions(
  userAddress: string | undefined
): UseUserVaultPositionsResult {
  const request = useMemo(() => {
    if (!userAddress) return null;
    try {
      return {
        user: evmAddress(userAddress as `0x${string}`),
        orderBy: { shares: OrderDirection.Desc },
        pageSize: PageSize.Fifty,
      };
    } catch {
      return null;
    }
  }, [userAddress]);

  const { data, loading, error } = useUserVaults(
    request ?? ({} as Parameters<typeof useUserVaults>[0])
  );

  const vaults = data?.items ?? [];
  const pageInfo = data?.pageInfo;

  return {
    vaults: request ? vaults : [],
    loading: !!request && loading,
    error: error ?? undefined,
    pageInfo,
  };
}
