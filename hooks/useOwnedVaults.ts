"use client";

import { useMemo } from "react";
import {
  useVaults,
  evmAddress,
  PageSize,
  type Vault,
  type PaginatedVaultsResult,
} from "@aave/react";

type UseOwnedVaultsResult = {
  vaults: Vault[];
  loading: boolean;
  error: Error | undefined;
  pageInfo: PaginatedVaultsResult["pageInfo"] | undefined;
};

/**
 * Fetches Aave Earn vaults owned by the given address via Aave Labs API.
 * Uses vaults({ criteria: { ownedBy: [address] }, user, pageSize }).
 */
export function useOwnedVaults(ownerAddress: string | undefined): UseOwnedVaultsResult {
  const request = useMemo(() => {
    const address = ownerAddress ?? "0x0000000000000000000000000000000000000000";
    try {
      return {
        criteria: {
          ownedBy: [evmAddress(address as `0x${string}`)],
        },
        user: evmAddress(address as `0x${string}`),
        pageSize: PageSize.Ten,
      };
    } catch {
      return null;
    }
  }, [ownerAddress]);

  const { data, loading, error } = useVaults(request ?? ({} as Parameters<typeof useVaults>[0]));

  const vaults = data?.items ?? [];
  const pageInfo = data?.pageInfo;
  const hasOwner = !!ownerAddress;

  return {
    vaults: hasOwner ? vaults : [],
    loading: hasOwner && loading,
    error: error ?? undefined,
    pageInfo,
  };
}
