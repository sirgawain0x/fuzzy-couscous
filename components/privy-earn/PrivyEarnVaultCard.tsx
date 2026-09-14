"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { StrategyCard } from "@/components/strategies/StrategyCard";
import { PrivyEarnVaultModal } from "@/components/privy-earn/PrivyEarnVaultModal";
import { useAuth } from "@/context/AuthContext";
import { usePrivyEarnPosition, usePrivyEarnVault } from "@/hooks/usePrivyEarn";
import { PRIVY_EARN_DISCLAIMER, PRIVY_EARN_DISPLAY } from "@/lib/config/privyEarn";
import { formatPercent, formatUsd } from "@/lib/formatters";

type PrivyEarnVaultCardProps = {
  userAssetBalance?: bigint;
  isBalanceLoading?: boolean;
};

const formatToken = (raw: string, decimals: number): string => {
  try {
    return formatUnits(BigInt(raw), decimals);
  } catch {
    return "0";
  }
};

export const PrivyEarnVaultCard = ({
  userAssetBalance = 0n,
  isBalanceLoading = false,
}: PrivyEarnVaultCardProps) => {
  const { status: authStatus, login } = useAuth();
  const { vault, loading: vaultLoading, error: vaultError } = usePrivyEarnVault();
  const isLoggedIn = authStatus === "logged-in";
  const { position, loading: positionLoading } = usePrivyEarnPosition(isLoggedIn);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"deposit" | "withdraw">("deposit");

  const decimals = vault?.asset.decimals ?? 6;
  const assetSymbol = (vault?.asset.symbol ?? "usdc").toUpperCase();
  const hasPosition = useMemo(() => {
    if (!position) return false;
    try {
      return BigInt(position.assetsInVault) > 0n || BigInt(position.sharesInVault) > 0n;
    } catch {
      return false;
    }
  }, [position]);

  const handleOpenDeposit = useCallback(() => {
    if (!isLoggedIn) {
      login();
      return;
    }
    setModalMode("deposit");
    setModalOpen(true);
  }, [isLoggedIn, login]);

  const handleOpenWithdraw = useCallback(() => {
    if (!isLoggedIn) {
      login();
      return;
    }
    setModalMode("withdraw");
    setModalOpen(true);
  }, [isLoggedIn, login]);

  const aprDisplay = vaultLoading
    ? "Loading..."
    : vaultError
      ? "Unavailable"
      : formatPercent(vault?.userApyPercent);

  const tvlDisplay = vaultLoading
    ? "Loading..."
    : vaultError
      ? "Unavailable"
      : formatUsd(vault?.tvlUsd);

  const title = vault?.name ?? PRIVY_EARN_DISPLAY.title;
  const explorerUrl = vault?.vaultAddress
    ? `https://basescan.org/address/${vault.vaultAddress}`
    : null;

  return (
    <>
      <StrategyCard
        title={title}
        subtitle={PRIVY_EARN_DISPLAY.subtitle}
        apr={aprDisplay}
        tvl={tvlDisplay}
        description={PRIVY_EARN_DISPLAY.description}
        actions={[
          {
            id: "deposit",
            label: isLoggedIn ? "Deposit" : "Sign in to deposit",
            ariaLabel: `Deposit ${assetSymbol} into ${title}`,
            onClick: handleOpenDeposit,
          },
          ...(explorerUrl
            ? [
                {
                  id: "view-basescan",
                  label: "View on Basescan",
                  ariaLabel: `View ${title} vault contract on Basescan`,
                  onClick: () => window.open(explorerUrl, "_blank", "noopener,noreferrer"),
                },
              ]
            : []),
          ...(hasPosition
            ? [
                {
                  id: "withdraw",
                  label: "Withdraw",
                  ariaLabel: `Withdraw ${assetSymbol} from ${title}`,
                  onClick: handleOpenWithdraw,
                },
              ]
            : []),
        ]}
        footnote={
          <div className="flex flex-col gap-2 text-xs text-slate-500">
            {vault?.vaultAddress ? (
              <div>
                <span className="font-semibold text-slate-700">Vault address: </span>
                <Link
                  href={`https://basescan.org/address/${vault.vaultAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-slate-600 underline underline-offset-2 hover:text-slate-900"
                >
                  {vault.vaultAddress}
                </Link>
              </div>
            ) : null}
            {vaultError ? <p className="text-red-600">{vaultError}</p> : null}
            {hasPosition && position ? (
              <div className="flex flex-col gap-1 border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-900">Your position</span>
                <p>
                  {formatToken(position.assetsInVault, decimals)} {assetSymbol} in vault
                  {positionLoading ? " (updating…)" : ""}
                </p>
                <p>
                  Earned yield: {formatToken(position.earnedYield, decimals)} {assetSymbol}
                </p>
              </div>
            ) : null}
            <p className={hasPosition ? "border-t border-slate-200 pt-2" : undefined}>
              {PRIVY_EARN_DISCLAIMER}
            </p>
          </div>
        }
      />

      <PrivyEarnVaultModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        vault={vault}
        position={position}
        userAssetBalance={userAssetBalance}
        isBalanceLoading={isBalanceLoading}
      />
    </>
  );
};
