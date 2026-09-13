"use client";

import { useMemo } from "react";
import { useReadContract, useAccount } from "wagmi";
import { formatUnits, type Address } from "viem";
import { SYMBIOTIC_VAULT_ABI } from "@/lib/config/symbiotic";

/**
 * Reads Symbiotic vault data: total supply, user balance, collateral asset.
 * Operates on Ethereum mainnet (chain ID 1).
 */
export function useSymbioticVault(vaultAddress: Address, decimals: number = 18) {
  const { address: userAddress } = useAccount();

  const { data: totalSupply, isLoading: supplyLoading } = useReadContract({
    address: vaultAddress,
    abi: SYMBIOTIC_VAULT_ABI,
    functionName: "totalSupply",
    chainId: 1,
  });

  const { data: userBalance, isLoading: balanceLoading } = useReadContract({
    address: vaultAddress,
    abi: SYMBIOTIC_VAULT_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    chainId: 1,
    query: { enabled: !!userAddress },
  });

  const formattedTvl = useMemo(() => {
    if (!totalSupply) return "—";
    return `${Number(formatUnits(totalSupply as bigint, decimals)).toLocaleString()} shares`;
  }, [totalSupply, decimals]);

  const formattedBalance = useMemo(() => {
    if (!userBalance) return "0";
    return formatUnits(userBalance as bigint, decimals);
  }, [userBalance, decimals]);

  const hasPosition = useMemo(
    () => userBalance != null && (userBalance as bigint) > 0n,
    [userBalance]
  );

  return {
    totalSupply: totalSupply as bigint | undefined,
    userBalance: userBalance as bigint | undefined,
    formattedTvl,
    formattedBalance,
    hasPosition,
    isLoading: supplyLoading || balanceLoading,
  };
}
