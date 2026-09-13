"use client";

import { useState } from "react";
import { type Address } from "viem";
import { useChainId, useSwitchChain } from "wagmi";
import { StrategyCard } from "@/components/strategies/StrategyCard";
import { useSymbioticVault } from "@/hooks/useSymbioticVault";
import {
  SYMBIOTIC_CHAIN_ID,
  SYMBIOTIC_RECOMMENDED_MIN_USD,
  type SymbioticVaultConfig,
} from "@/lib/config/symbiotic";

interface SymbioticVaultCardProps {
  vault: SymbioticVaultConfig;
}

/**
 * Strategy card for Symbiotic restaking vaults on Ethereum mainnet.
 * Gated behind Investor/Brand membership via PremiumGuard in the parent page.
 */
export function SymbioticVaultCard({ vault }: SymbioticVaultCardProps) {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { formattedTvl, hasPosition, formattedBalance, isLoading } = useSymbioticVault(
    vault.address as Address,
    vault.collateralDecimals
  );

  const [showInfo, setShowInfo] = useState(false);
  const isCorrectChain = chainId === SYMBIOTIC_CHAIN_ID;

  const handleDeposit = () => {
    if (!isCorrectChain) {
      switchChain?.({ chainId: SYMBIOTIC_CHAIN_ID });
      return;
    }
    // Open Symbiotic app for deposit (direct contract interaction requires
    // collateral token approval + deposit call — complex for MVP)
    window.open(
      `https://app.symbiotic.fi/restake/${vault.address}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <StrategyCard
      title={vault.name}
      subtitle={`Symbiotic Restaking • ${vault.collateralSymbol} • Ethereum${hasPosition ? " • 📍 Active Position" : ""}`}
      apr="Variable"
      tvl={isLoading ? "Loading..." : formattedTvl}
      description={vault.description}
      actions={[
        {
          id: "restake",
          label: isCorrectChain ? "Restake" : "Switch to Ethereum",
          ariaLabel: `Restake ${vault.collateralSymbol} into Symbiotic`,
          onClick: handleDeposit,
        },
        {
          id: "info",
          label: showInfo ? "Hide Details" : "Details",
          ariaLabel: "Toggle vault details",
          onClick: () => setShowInfo(!showInfo),
        },
      ]}
      footnote={
        showInfo ? (
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex justify-between">
              <span>Collateral</span>
              <span className="font-medium">{vault.collateralSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span>Network</span>
              <span className="font-medium">Ethereum Mainnet</span>
            </div>
            {vault.curator && (
              <div className="flex justify-between">
                <span>Curator</span>
                <span className="font-medium">{vault.curator}</span>
              </div>
            )}
            {hasPosition && (
              <div className="flex justify-between">
                <span>Your Balance</span>
                <span className="font-medium">{formattedBalance} shares</span>
              </div>
            )}
            <p className="mt-1 text-slate-500">
              Recommended deposit: ${SYMBIOTIC_RECOMMENDED_MIN_USD.toLocaleString()}+. Smaller
              deposits may see yield diluted by Ethereum mainnet gas fees.
            </p>
          </div>
        ) : undefined
      }
    />
  );
}
