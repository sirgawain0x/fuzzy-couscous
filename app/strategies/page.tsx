"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@crossmint/client-sdk-react-ui";

import { StrategyCard } from "@/components/strategies/StrategyCard";
import { PremiumGuard } from "@/components/access/PremiumGuard";
import { VaultDeployModal } from "@/components/vaults/VaultDeployModal";
import { DeployedVaultCard } from "@/components/vaults/DeployedVaultCard";
import { MyDeployedVaults } from "@/components/vaults/MyDeployedVaults";
import { ATokenBalance } from "@/components/vaults/ATokenBalance";
import { useUserVaultPositions } from "@/hooks/useUserVaultPositions";
import { YearnVaultCard } from "@/components/yearn/YearnVaultCard";
import { SymbioticVaultCard } from "@/components/symbiotic/SymbioticVaultCard";
import { SYMBIOTIC_VAULTS } from "@/lib/config/symbiotic";
import { useBaseUsdcReserve } from "@/hooks/useBaseUsdcReserve";
import { useKalaniApr } from "@/hooks/useKalaniApr";
import { useBalance } from "@/hooks/useBalance";
import { formatPercent, formatUsd } from "@/lib/formatters";
import {
  KALANI_VAULT_ADDRESSES,
  CREATIVE_BANK_VAULT,
  CREATIVE_BANK_BOUNCER_ADDRESS,
} from "@/lib/config/kalani";
import { useMembership } from "@/context/MembershipContext";
import { shortenAddress } from "@/utils/shortenAddress";
import { parseUnits, type Address } from "viem";
import { CopyWrapper } from "@/components/common/CopyWrapper";

function StrategiesContent({
  walletAddress,
  onDeployClick,
  baseReserve,
  kalani,
  userUsdcBalance,
}: {
  walletAddress: string | null;
  onDeployClick: () => void;
  baseReserve: ReturnType<typeof useBaseUsdcReserve>;
  kalani: ReturnType<typeof useKalaniApr>;
  userUsdcBalance: bigint;
}) {
  const { vaults: userPositionVaults, loading: userPositionsLoading } = useUserVaultPositions(
    walletAddress ?? undefined
  );

  const otherPositionVaults = useMemo(() => {
    if (!walletAddress) return [];
    return userPositionVaults.filter((v) => v.owner?.toLowerCase() !== walletAddress.toLowerCase());
  }, [userPositionVaults, walletAddress]);

  const baseApr = baseReserve.loading
    ? "Loading..."
    : formatPercent(baseReserve.reserve?.supplyInfo.apy?.formatted);
  const baseTvl = baseReserve.loading ? "Loading..." : formatUsd(baseReserve.reserve?.size.usd);

  const kalaniAprDisplay = kalani.loading
    ? "Loading..."
    : kalani.error
      ? "Unavailable"
      : kalani.apr !== undefined
        ? formatPercent(kalani.apr, "Pending oracle update")
        : "Pending oracle update";

  const kalaniFootnote = useMemo(
    () => (
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-slate-900">Key Contracts</span>
        <ul className="list-disc pl-4 text-xs text-slate-500">
          <li>
            Role Manager Factory:{" "}
            <Link
              href={`https://basescan.org/address/${KALANI_VAULT_ADDRESSES.roleManagerFactory}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {KALANI_VAULT_ADDRESSES.roleManagerFactory}
            </Link>
          </li>
          <li>
            APR Oracle:{" "}
            <Link
              href={`https://basescan.org/address/${KALANI_VAULT_ADDRESSES.aprOracle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {KALANI_VAULT_ADDRESSES.aprOracle}
            </Link>
          </li>
          <li>
            Address Provider:{" "}
            <Link
              href={`https://basescan.org/address/${KALANI_VAULT_ADDRESSES.addressProvider}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {KALANI_VAULT_ADDRESSES.addressProvider}
            </Link>
          </li>
        </ul>
      </div>
    ),
    []
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StrategyCard
          title="Aave USDC Earn Vault"
          subtitle="Deploy a branded ERC-4626 vault sourcing yield from the Base USDC reserve."
          apr={baseApr}
          tvl={baseTvl}
          description="Create an on-chain USDC vault with automated fee routing, transparent reporting, and direct integration to the Aave Base money market."
          actions={[
            {
              id: "deploy-vault",
              label: "Deploy Vault",
              ariaLabel: "Deploy Aave USDC vault",
              onClick: onDeployClick,
            },
            {
              id: "view-reserve",
              label: "View Reserve",
              ariaLabel: "View USDC reserve on Aave",
              onClick: () =>
                window.open(
                  "https://app.aave.com/reserve-overview/?underlyingAsset=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&marketName=proto_base_v3",
                  "_blank",
                  "noopener,noreferrer"
                ),
            },
          ]}
          footnote={
            <p>
              Yield powered by the Base Aave v3 USDC reserve. Deployments require a connected wallet
              with USDC balance for the initial seed.
            </p>
          }
        />

        <PremiumGuard requiredTier="Creative Investor">
          <YearnVaultCard
            vaultAddress={CREATIVE_BANK_VAULT.address}
            assetAddress={CREATIVE_BANK_VAULT.asset}
            assetSymbol={CREATIVE_BANK_VAULT.assetSymbol}
            assetDecimals={6}
            name={CREATIVE_BANK_VAULT.name}
            description="Premium Yearn V3 multi-strategy vault exclusively for Creative Bank members. Features automated yield optimization, bespoke role management, and professional treasury automation powered by Kalani."
            estimatedApr={kalani.loading ? undefined : kalani.error ? undefined : kalani.apr}
            userAssetBalance={userUsdcBalance}
            bouncerAddress={CREATIVE_BANK_BOUNCER_ADDRESS}
          />
        </PremiumGuard>
      </div>

      {/* aToken Balance (shown when user has aBaseUSDC from fee withdrawals) */}
      <section className="mt-10">
        <ATokenBalance />
      </section>

      {/* Symbiotic Restaking — Investor+ tier */}
      <section className="mt-10">
        <PremiumGuard requiredTier="Creative Investor" silent>
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-slate-900">Restaking Vaults</h2>
            <p className="text-sm text-slate-600">
              Stake assets into Symbiotic to earn restaking rewards from securing cross-chain
              infrastructure. Operates on Ethereum Mainnet.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {SYMBIOTIC_VAULTS.map((vault) => (
              <SymbioticVaultCard key={vault.address} vault={vault} />
            ))}
          </div>
        </PremiumGuard>
      </section>

      {/* My Deployed Vaults Section */}
      <section className="mt-10">
        <MyDeployedVaults />
      </section>

      {/* Your positions in other vaults */}
      {otherPositionVaults.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-slate-900">Your positions in other vaults</h2>
            <p className="text-sm text-slate-600">
              Vaults you have deposited into (not owned by you).
            </p>
          </div>
          {userPositionsLoading ? (
            <p className="text-sm text-slate-500">Loading positions…</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {otherPositionVaults.map((vault) => (
                <DeployedVaultCard
                  key={`${vault.address}-${vault.chainId}`}
                  vault={vault}
                  vaultAddress={vault.address as Address}
                  assetAddress={vault.usedReserve?.underlyingToken?.address as Address}
                  assetSymbol={vault.usedReserve?.underlyingToken?.symbol ?? "USDC"}
                  assetDecimals={vault.usedReserve?.underlyingToken?.decimals ?? 6}
                  name={vault.shareName}
                  performanceFee={
                    vault.fee?.formatted != null
                      ? Number.parseFloat(String(vault.fee.formatted))
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Yearn V3 Vaults Section */}
      {/* <section className="mt-10 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-slate-900">Vaults</h2>
          <p className="text-sm text-slate-600">
            Deposit into ERC-4626 compliant vaults with standardized deposit and withdrawal
            flows. All vaults feature maxLoss protection and transparent on-chain pricing.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center bg-white/80">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-slate-500">More vaults coming soon</p>
              <p className="text-xs text-slate-400">
                Additional vault strategies will be added as they become available.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center bg-white/80">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-slate-500">More vaults coming soon</p>
              <p className="text-xs text-slate-400">
                Additional vault strategies will be added as they become available.
              </p>
            </div>
          </div>
        </div>
      </section> */}
    </>
  );
}

export default function StrategiesPage() {
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { wallet, status: walletStatus } = useWallet();
  const { status: authStatus } = useAuth();
  const membership = useMembership();

  const baseReserve = useBaseUsdcReserve();
  const kalani = useKalaniApr();
  const { balances } = useBalance();

  const userUsdcBalance = useMemo(() => {
    if (!balances?.usdc?.amount) return BigInt(0);
    try {
      return parseUnits(balances.usdc.amount, 6);
    } catch {
      return BigInt(0);
    }
  }, [balances]);

  const walletStatusLabel = useMemo(() => {
    if (walletStatus === "in-progress" || authStatus === "initializing") {
      return "Connecting...";
    }
    if (!wallet || authStatus !== "logged-in") {
      return "Not connected";
    }
    const crossmintAddress = wallet.address;
    if (!crossmintAddress) {
      return "Not connected";
    }
    return shortenAddress(crossmintAddress);
  }, [authStatus, wallet, walletStatus]);

  const walletAddress = useMemo(() => {
    if (!wallet || authStatus !== "logged-in" || !wallet.address) {
      return null;
    }
    return wallet.address;
  }, [authStatus, wallet]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/"
            aria-label="Return to Creative Bank home"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            Back to Home
          </Link>
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh vault and position data"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            Refresh
          </button>
        </div>
        <div className="flex flex-col gap-3 rounded-3xl border border-white/40 bg-white/80 p-6 shadow-lg shadow-slate-900/10 backdrop-blur">
          <p className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
            Creative Bank DeFi Suite
          </p>
          <h1 className="text-center text-3xl font-semibold text-slate-900 md:text-4xl">
            Programmatic Yield Strategies
          </h1>
          <p className="mx-auto max-w-2xl text-center text-sm leading-6 text-slate-600">
            Launch an Aave Earn Vault backed by the Base USDC reserve, deposit into Yearn V3
            ERC-4626 compliant vaults, and unlock our token-gated Kalani premium strategies for
            high-touch treasury automation.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            Connected Wallet:{" "}
            {walletAddress ? (
              <CopyWrapper
                toCopy={walletAddress}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
                iconPosition="right"
              >
                <span>{walletStatusLabel}</span>
              </CopyWrapper>
            ) : (
              <span>{walletStatusLabel}</span>
            )}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            Membership Tier: {membership.isLoading ? "Checking..." : (membership.tier ?? "None")}
          </span>
        </div>
      </header>

      {baseReserve.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load Aave market data: {baseReserve.error.message}
        </div>
      ) : null}

      {kalani.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Kalani APR unavailable: {kalani.error}
        </div>
      ) : null}

      <StrategiesContent
        key={refreshKey}
        walletAddress={walletAddress}
        onDeployClick={() => setDeployModalOpen(true)}
        baseReserve={baseReserve}
        kalani={kalani}
        userUsdcBalance={userUsdcBalance}
      />

      <VaultDeployModal
        open={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        onSuccess={handleRefresh}
        market={baseReserve.market}
        reserve={baseReserve.reserve}
      />
    </main>
  );
}
