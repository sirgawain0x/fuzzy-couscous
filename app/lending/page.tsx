"use client";

import { useMemo, useState, useCallback, Fragment } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import {
  bigDecimal,
  evmAddress,
  errAsync,
  useAaveHealthFactorPreview,
  useBorrow,
  useCollateralToggle,
  useRepay,
  useSupply,
  useUserBorrows,
  useUserMarketState,
  useUserSupplies,
  useWithdraw,
} from "@aave/react";
import { usePublicClient } from "wagmi";

import { Modal } from "@/components/common/Modal";
import { CopyWrapper } from "@/components/common/CopyWrapper";
import { PremiumGuard } from "@/components/access/PremiumGuard";
import { LendingMeritRewards } from "@/components/lending/LendingMeritRewards";
import { LendingTransactionHistory } from "@/components/lending/LendingTransactionHistory";
import { EModeSelector } from "@/components/lending/EModeSelector";
import { IsolationModeWarning } from "@/components/lending/IsolationModeWarning";
import { useBaseUsdcReserve } from "@/hooks/useBaseUsdcReserve";
import { useBalance } from "@/hooks/useBalance";
import { useAaveWalletClient } from "@/hooks/useAaveWalletClient";
import { useMembership } from "@/context/MembershipContext";
import { formatPercent, formatUsd } from "@/lib/formatters";
import {
  canSafelyDisableCollateral,
  formatHealthFactorDisplay,
  getHealthFactorStatusLabel,
} from "@/lib/healthFactor";
import { shortenAddress } from "@/utils/shortenAddress";
import { AAVE_TARGET_CHAIN_ID } from "@/lib/config/aave";
import { isAddress, type WalletClient } from "viem";
import {
  normalizeTxErrorMessage,
  showTxErrorToast,
  showTxSuccessToast,
} from "@/lib/transactionToast";
import type {
  Market,
  Reserve,
  MarketUserReserveSupplyPosition,
  MarketUserReserveBorrowPosition,
} from "@aave/react";

const AAVE_USDC_RESERVE_URL =
  "https://app.aave.com/reserve-overview/?underlyingAsset=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&marketName=proto_base_v3";

type ActionModalKind = "supply" | "withdraw" | "borrow" | "repay" | null;

type LendingContentProps = {
  baseReserve: ReturnType<typeof useBaseUsdcReserve>;
  walletAddress: string | null;
  walletClient: ReturnType<typeof useAaveWalletClient>;
  walletUsdcBalance: string;
  isBalanceLoading?: boolean;
  actionModal: ActionModalKind;
  setActionModal: (kind: ActionModalKind) => void;
};

function LendingContent({
  baseReserve,
  walletAddress,
  walletClient,
  walletUsdcBalance,
  isBalanceLoading,
  actionModal,
  setActionModal,
}: LendingContentProps) {
  const marketsInput = useMemo(() => {
    if (!baseReserve.market?.address) return [];
    return [
      {
        address: evmAddress(baseReserve.market.address),
        chainId: AAVE_TARGET_CHAIN_ID,
      },
    ];
  }, [baseReserve.market?.address]);

  const userEvm = useMemo(
    () =>
      walletAddress
        ? evmAddress(walletAddress)
        : evmAddress("0x0000000000000000000000000000000000000000"),
    [walletAddress]
  );

  const { data: supplies = [], loading: suppliesLoading } = useUserSupplies({
    markets: marketsInput,
    user: userEvm,
  });

  const { data: borrows = [], loading: borrowsLoading } = useUserBorrows({
    markets: marketsInput,
    user: userEvm,
  });

  const marketAddressEvm = useMemo(
    () =>
      baseReserve.market?.address
        ? evmAddress(baseReserve.market.address)
        : evmAddress("0x0000000000000000000000000000000000000000"),
    [baseReserve.market?.address]
  );

  const { data: userMarketState, loading: marketStateLoading } = useUserMarketState({
    market: marketAddressEvm,
    user: userEvm,
    chainId: AAVE_TARGET_CHAIN_ID,
  });

  const usdcSupplyPosition = useMemo(
    () => supplies.find((s) => s.currency?.symbol?.toUpperCase() === "USDC"),
    [supplies]
  );

  const hasUsdcSupply = useMemo(
    () => Boolean(usdcSupplyPosition && Number(usdcSupplyPosition.balance?.amount?.value ?? 0) > 0),
    [usdcSupplyPosition]
  );

  const usdcBorrowPosition = useMemo(
    () => borrows.find((b) => b.currency?.symbol?.toUpperCase() === "USDC"),
    [borrows]
  );

  const hasUsdcBorrow = useMemo(
    () => Boolean(usdcBorrowPosition && Number(usdcBorrowPosition.debt?.amount?.value ?? 0) > 0),
    [usdcBorrowPosition]
  );

  const canToggleCollateral =
    usdcSupplyPosition &&
    usdcSupplyPosition.canBeCollateral != null &&
    (usdcSupplyPosition.isCollateral ? true : usdcSupplyPosition.canBeCollateral);

  const disableCollateralBlocked =
    canToggleCollateral &&
    usdcSupplyPosition!.isCollateral &&
    hasUsdcBorrow &&
    !canSafelyDisableCollateral(userMarketState?.healthFactor, hasUsdcBorrow);

  const availableBorrowUsd = useMemo(() => {
    const raw = userMarketState?.availableBorrowsBase;
    if (raw == null) return null;
    const value =
      typeof raw === "object" && raw !== null && "value" in raw
        ? Number((raw as { value: string }).value)
        : Number(raw);
    return Number.isNaN(value) || value <= 0 ? null : value;
  }, [userMarketState?.availableBorrowsBase]);

  return (
    <Fragment>
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">USDC on Base</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Supply APR</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatPercent(baseReserve.reserve?.supplyInfo?.apy?.formatted)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Borrow APR</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatPercent(baseReserve.reserve?.borrowInfo?.apy?.formatted)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total size</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatUsd(baseReserve.reserve?.size?.usd)}
            </p>
          </div>
          <div className="flex items-end">
            <a
              href={AAVE_USDC_RESERVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-sm font-medium hover:underline"
            >
              View on Aave →
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Your positions</h2>
        {!walletAddress ? (
          <p className="text-sm text-slate-500">
            Connect a wallet to view your positions and health factor.
          </p>
        ) : marketStateLoading || suppliesLoading || borrowsLoading ? (
          <p className="text-sm text-slate-500">Loading positions…</p>
        ) : (
          <div className="flex flex-col gap-4">
            {hasUsdcSupply &&
              userMarketState?.healthFactor != null &&
              (() => {
                const statusInfo = getHealthFactorStatusLabel(
                  userMarketState.healthFactor,
                  hasUsdcBorrow
                );
                const display =
                  statusInfo ??
                  (hasUsdcSupply
                    ? { status: "safe" as const, label: "Safe", ariaLabel: "Your loan is healthy" }
                    : null);
                return (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-slate-500">Health factor</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {Number(userMarketState.healthFactor).toFixed(2)}
                    </p>
                    {display != null && (
                      <span
                        role="status"
                        aria-label={display.ariaLabel}
                        className={[
                          "inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium",
                          display.status === "safe" && "bg-emerald-100 text-emerald-800",
                          display.status === "warning" && "bg-amber-100 text-amber-800",
                          display.status === "danger" && "bg-red-100 text-red-800",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {display.label}
                      </span>
                    )}
                  </div>
                );
              })()}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Supplied (USDC)</p>
                <p className="text-lg font-semibold text-slate-900">
                  {usdcSupplyPosition?.balance?.amount?.value ?? "0"}
                </p>
                {usdcSupplyPosition?.balance?.usd != null && (
                  <p className="text-xs text-slate-500">
                    {formatUsd(usdcSupplyPosition.balance.usd)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Borrowed (USDC)</p>
                <p className="text-lg font-semibold text-slate-900">
                  {usdcBorrowPosition?.debt?.amount?.value ?? "0"}
                </p>
                {usdcBorrowPosition?.debt?.usd != null && (
                  <p className="text-xs text-slate-500">{formatUsd(usdcBorrowPosition.debt.usd)}</p>
                )}
              </div>
            </div>
            {canToggleCollateral && baseReserve.market && (
              <CollateralToggle
                market={baseReserve.market}
                position={usdcSupplyPosition!}
                userEvm={userEvm!}
                walletClient={walletClient}
                disableCollateralBlocked={disableCollateralBlocked}
                onSuccess={() => {}}
              />
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Actions</h2>
        {!walletClient ? (
          <p className="text-sm text-slate-500">
            Connect a wallet to supply, withdraw, borrow, or repay.
          </p>
        ) : (
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={() => setActionModal("supply")}
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-primary rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex-shrink-0"
              aria-label="Supply USDC"
            >
              Supply USDC
            </button>
            <button
              type="button"
              onClick={() => setActionModal("withdraw")}
              disabled={!hasUsdcSupply}
              title={!hasUsdcSupply ? "Supply USDC first to withdraw" : undefined}
              aria-disabled={!hasUsdcSupply}
              aria-label="Withdraw USDC"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white sm:flex-shrink-0"
            >
              Withdraw
            </button>
            <button
              type="button"
              onClick={() => setActionModal("borrow")}
              disabled={!hasUsdcSupply}
              title={!hasUsdcSupply ? "Supply USDC first to borrow" : undefined}
              aria-disabled={!hasUsdcSupply}
              aria-label="Borrow USDC"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white sm:flex-shrink-0"
            >
              Borrow USDC
            </button>
            <button
              type="button"
              onClick={() => setActionModal("repay")}
              disabled={!hasUsdcBorrow}
              title={!hasUsdcBorrow ? "Borrow USDC first to repay" : undefined}
              aria-disabled={!hasUsdcBorrow}
              aria-label="Repay USDC"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white sm:flex-shrink-0"
            >
              Repay
            </button>
          </div>
        )}
        {walletClient && hasUsdcSupply && availableBorrowUsd != null && (
          <p className="mt-3 text-center text-sm text-slate-600" role="status">
            Available to borrow:{" "}
            <span className="font-medium text-slate-900">{formatUsd(availableBorrowUsd)} USDC</span>{" "}
            (based on your collateral and health factor)
          </p>
        )}
      </section>

      <LendingTransactionHistory
        marketAddressEvm={marketAddressEvm}
        userEvm={userEvm}
        walletAddress={walletAddress}
      />

      <LendingMeritRewards
        userEvm={userEvm}
        walletClient={walletClient}
        walletAddress={walletAddress}
      />

      {/* Isolation Mode Warning */}
      <IsolationModeWarning
        isInIsolationMode={userMarketState?.isInIsolationMode ?? false}
        isolatedReserve={baseReserve.reserve ?? undefined}
      />

      {/* E-Mode Selector — Investor+ tier */}
      <PremiumGuard requiredTier="Creative Investor">
        {baseReserve.market && walletAddress && (
          <EModeSelector
            market={baseReserve.market}
            userAddress={walletAddress}
            currentEModeEnabled={userMarketState?.eModeEnabled ?? false}
            currentEModeCategoryId={(userMarketState as any)?.eModeCategoryId}
          />
        )}
      </PremiumGuard>

      <PremiumGuard requiredTier="Creative Creator" silent>
        <LendingAdvancedSection
          marketAddressEvm={marketAddressEvm}
          userEvm={userEvm}
          walletAddress={walletAddress}
          walletClient={walletClient}
          reserve={baseReserve.reserve ?? undefined}
          hasUsdcSupply={hasUsdcSupply}
          currentHealthFactor={userMarketState?.healthFactor ?? null}
          supplyBalance={usdcSupplyPosition?.balance?.amount?.value ?? null}
          hasBorrows={hasUsdcBorrow}
        />
      </PremiumGuard>

      {actionModal === "supply" &&
        baseReserve.reserve &&
        baseReserve.market &&
        walletAddress &&
        walletClient && (
          <SupplyModal
            market={baseReserve.market}
            reserve={baseReserve.reserve}
            sender={evmAddress(walletAddress)}
            walletClient={walletClient ?? undefined}
            walletUsdcBalance={walletUsdcBalance}
            isBalanceLoading={isBalanceLoading}
            onClose={() => setActionModal(null)}
            onSuccess={() => setActionModal(null)}
          />
        )}
      {actionModal === "withdraw" &&
        baseReserve.reserve &&
        baseReserve.market &&
        walletAddress &&
        walletClient && (
          <WithdrawModal
            market={baseReserve.market}
            reserve={baseReserve.reserve}
            supplyPosition={usdcSupplyPosition ?? undefined}
            sender={evmAddress(walletAddress)}
            walletClient={walletClient ?? undefined}
            onClose={() => setActionModal(null)}
            onSuccess={() => setActionModal(null)}
          />
        )}
      {actionModal === "borrow" &&
        baseReserve.reserve &&
        baseReserve.market &&
        walletAddress &&
        walletClient && (
          <BorrowModal
            market={baseReserve.market}
            reserve={baseReserve.reserve}
            sender={evmAddress(walletAddress)}
            walletClient={walletClient ?? undefined}
            availableBorrowUsd={availableBorrowUsd}
            onClose={() => setActionModal(null)}
            onSuccess={() => setActionModal(null)}
          />
        )}
      {actionModal === "repay" &&
        baseReserve.reserve &&
        baseReserve.market &&
        walletAddress &&
        walletClient && (
          <RepayModal
            market={baseReserve.market}
            reserve={baseReserve.reserve}
            borrowPosition={usdcBorrowPosition ?? undefined}
            sender={evmAddress(walletAddress)}
            walletClient={walletClient ?? undefined}
            onClose={() => setActionModal(null)}
            onSuccess={() => setActionModal(null)}
          />
        )}
    </Fragment>
  );
}

export default function LendingPage() {
  const { wallet, status: walletStatus } = useWallet();
  const { status: authStatus } = useAuth();
  const membership = useMembership();
  const baseReserve = useBaseUsdcReserve();
  const walletClient = useAaveWalletClient();
  const { balances, displayableBalance, isLoading: isBalanceLoading } = useBalance();
  const [actionModal, setActionModal] = useState<ActionModalKind>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const walletUsdcBalance = balances?.usdc?.amount ?? "0";

  const walletAddress = useMemo(() => {
    if (!wallet || authStatus !== "logged-in" || !wallet.address) return null;
    return wallet.address;
  }, [authStatus, wallet]);

  const walletStatusLabel = useMemo(() => {
    if (walletStatus === "in-progress" || authStatus === "initializing") return "Connecting...";
    if (!wallet || authStatus !== "logged-in") return "Not connected";
    return shortenAddress(wallet.address ?? "");
  }, [authStatus, wallet, walletStatus]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
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
            aria-label="Refresh positions and market data"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            Refresh
          </button>
        </div>
        <div className="flex flex-col gap-3 rounded-3xl border border-white/40 bg-white/80 p-6 shadow-lg shadow-slate-900/10 backdrop-blur">
          <p className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
            Aave Markets
          </p>
          <h1 className="text-center text-3xl font-semibold text-slate-900 md:text-4xl">
            Lend & Borrow
          </h1>
          <p className="mx-auto max-w-2xl text-center text-sm leading-6 text-slate-600">
            Supply USDC to earn interest and borrow against your collateral on Aave V3 (Base).
            Manage your positions and health factor in one place.
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

      {baseReserve.loading || !baseReserve.market || !baseReserve.reserve ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          Loading market…
        </div>
      ) : (
        <LendingContent
          key={refreshKey}
          baseReserve={baseReserve}
          walletAddress={walletAddress}
          walletClient={walletClient}
          walletUsdcBalance={walletUsdcBalance}
          isBalanceLoading={isBalanceLoading}
          actionModal={actionModal}
          setActionModal={setActionModal}
        />
      )}
    </main>
  );
}

type LendingAdvancedSectionProps = {
  marketAddressEvm: ReturnType<typeof evmAddress>;
  userEvm: ReturnType<typeof evmAddress>;
  walletAddress: string | null;
  walletClient: WalletClient | undefined;
  reserve?: Reserve | null;
  hasUsdcSupply: boolean;
  currentHealthFactor: number | string | null | undefined;
  supplyBalance: string | null;
  hasBorrows: boolean;
};

function LendingAdvancedSection({
  marketAddressEvm,
  userEvm,
  walletAddress,
  walletClient,
  reserve,
  hasUsdcSupply,
  currentHealthFactor,
  supplyBalance,
  hasBorrows,
}: LendingAdvancedSectionProps) {
  const [previewAmount, setPreviewAmount] = useState("");
  const [healthPreview, healthPreviewRunning] = useAaveHealthFactorPreview();
  const [healthPreviewResult, setHealthPreviewResult] = useState<{
    before: string | null;
    after: string | null;
  } | null>(null);

  const currentHealthLabel = formatHealthFactorDisplay(currentHealthFactor, hasBorrows);
  const canUseMax = hasUsdcSupply && supplyBalance != null && Number(supplyBalance) > 0;

  const handleUseMax = useCallback(() => {
    if (supplyBalance != null) setPreviewAmount(supplyBalance);
  }, [supplyBalance]);

  const handleHealthPreview = useCallback(async () => {
    const num = Number.parseFloat(previewAmount);
    if (!reserve || Number.isNaN(num) || num <= 0) return;
    setHealthPreviewResult(null);
    const result = await healthPreview({
      action: {
        supply: {
          market: marketAddressEvm,
          amount: {
            erc20: {
              currency: reserve.underlyingToken.address,
              value: bigDecimal(num),
            },
          },
          sender: userEvm,
          chainId: AAVE_TARGET_CHAIN_ID,
        },
      },
    });
    if (result.isOk()) {
      const v = result.value;
      setHealthPreviewResult({
        before: v.before != null ? String(v.before) : null,
        after: v.after != null ? String(v.after) : null,
      });
    } else {
      setHealthPreviewResult({ before: null, after: null });
    }
  }, [previewAmount, reserve, healthPreview, marketAddressEvm, userEvm]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Advanced (Members)</h2>
      {!walletAddress ? (
        <p className="text-sm text-slate-500">Connect a wallet to use the health factor preview.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {reserve != null && (
            <div
              className={!hasUsdcSupply ? "pointer-events-none opacity-50" : undefined}
              title={!hasUsdcSupply ? "Supply USDC first to use health factor preview" : undefined}
              aria-hidden={!hasUsdcSupply}
            >
              <h3 className="mb-1 text-sm font-medium text-slate-700">Health factor preview</h3>
              <p className="mb-3 text-xs text-slate-500">
                See how your health factor would change if you supplied more USDC. This is most
                useful when you have an open borrow.
              </p>

              <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-medium">Current health factor: </span>
                <span aria-label={`Current health factor is ${currentHealthLabel}`}>
                  {currentHealthLabel}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-500">
                    Additional USDC to supply (preview)
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={previewAmount}
                      onChange={(e) => setPreviewAmount(e.target.value)}
                      placeholder="0"
                      className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                      aria-label="Preview supply amount in USDC"
                      disabled={!hasUsdcSupply}
                    />
                    {canUseMax && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleUseMax();
                        }}
                        className="text-primary flex min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation items-center justify-center py-2 text-xs font-medium hover:underline disabled:opacity-50"
                        aria-label="Use maximum supplied USDC balance"
                      >
                        Use max
                      </button>
                    )}
                  </div>
                </label>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={handleHealthPreview}
                    disabled={!hasUsdcSupply || healthPreviewRunning.loading || !previewAmount}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {healthPreviewRunning.loading ? "Previewing…" : "Preview"}
                  </button>
                </div>
              </div>

              {healthPreviewResult != null && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <p className="font-medium text-slate-800">Preview result</p>
                  <p className="mt-1 text-slate-600">
                    Before:{" "}
                    <strong>
                      {formatHealthFactorDisplay(healthPreviewResult.before, hasBorrows)}
                    </strong>
                    {" → "}
                    After:{" "}
                    <strong>
                      {formatHealthFactorDisplay(healthPreviewResult.after, hasBorrows)}
                    </strong>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const TX_CONFIRMATION_TIMEOUT_MS = 120_000;

const COLLATERAL_TOOLTIP =
  "Yield-Only Mode — Earn a return without putting this deposit on the line for loans. It won't be liquidated even if other borrow positions get risky.";

const DISABLE_COLLATERAL_BLOCKED_MSG =
  "Cannot disable: This asset is currently securing your active loan. Repay your debt first to unlock this protection.";

function CollateralToggle({
  market,
  position,
  userEvm,
  walletClient,
  disableCollateralBlocked,
  onSuccess,
}: {
  market: Market;
  position: MarketUserReserveSupplyPosition;
  userEvm: ReturnType<typeof evmAddress>;
  walletClient: WalletClient | undefined;
  disableCollateralBlocked?: boolean;
  onSuccess: () => void;
}) {
  const [toggleCollateral] = useCollateralToggle();
  const publicClient = usePublicClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const isDisableAction = position.isCollateral;
  const buttonDisabled =
    isToggling || !walletClient || (isDisableAction && disableCollateralBlocked);

  const sendAndWait = useCallback(
    async (tx: { to: string; data: string; value?: string }) => {
      if (!walletClient || !publicClient) throw new Error("Wallet or RPC not available");
      const valueBigInt = tx.value ? BigInt(tx.value) : 0n;
      const hash = await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: (tx.data || "0x") as `0x${string}`,
        value: valueBigInt,
        account: { address: userEvm, type: "json-rpc" },
        chain: publicClient.chain as never as import("viem").Chain,
      });
      await publicClient.waitForTransactionReceipt({
        hash,
        timeout: TX_CONFIRMATION_TIMEOUT_MS,
      });
      return hash;
    },
    [walletClient, publicClient, userEvm]
  );

  const handleToggle = useCallback(async () => {
    if (!walletClient) return;
    setErrorMsg(null);
    setIsToggling(true);
    try {
      const result = await toggleCollateral({
        market: market.address,
        underlyingToken: position.currency.address,
        user: userEvm,
        chainId: AAVE_TARGET_CHAIN_ID,
      });
      if (result.isErr()) {
        const message = result.error?.message ?? "Toggle failed";
        setErrorMsg(message);
        showTxErrorToast({ title: "Collateral update failed", description: message });
        return;
      }
      const plan = result.value;
      const txHash = await sendAndWait(plan);
      showTxSuccessToast({
        title: "Collateral updated",
        description: position.isCollateral
          ? "USDC is no longer used as collateral."
          : "USDC is now used as collateral.",
        txHash,
      });
      onSuccess();
    } catch (err) {
      const message = normalizeTxErrorMessage(err, "Collateral update failed");
      setErrorMsg(message);
      showTxErrorToast({ title: "Collateral update failed", description: message });
    } finally {
      setIsToggling(false);
    }
  }, [
    market.address,
    position.currency.address,
    position.isCollateral,
    userEvm,
    walletClient,
    toggleCollateral,
    sendAndWait,
    onSuccess,
  ]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500">
        Collateral: {position.isCollateral ? "Enabled" : "Disabled"}
      </p>
      <p className="text-xs text-slate-500">{COLLATERAL_TOOLTIP}</p>
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer rounded font-medium text-slate-600 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-500">
          Learn more
        </summary>
        <p className="mt-1 text-slate-600">
          When enabled, this asset increases your Borrowing Power but is subject to liquidation if
          your Health Factor drops. When disabled, it acts as a pure savings account—earning
          interest while remaining untouchable by the protocol&apos;s liquidation engine.
        </p>
      </details>
      <button
        type="button"
        onClick={handleToggle}
        disabled={buttonDisabled}
        title={isDisableAction ? COLLATERAL_TOOLTIP : undefined}
        className="w-fit rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={position.isCollateral ? "Disable collateral" : "Enable collateral"}
      >
        {isToggling
          ? "Processing…"
          : position.isCollateral
            ? "Disable collateral"
            : "Enable collateral"}
      </button>
      {disableCollateralBlocked && isDisableAction && (
        <p className="text-sm text-amber-800" role="alert">
          {DISABLE_COLLATERAL_BLOCKED_MSG}
        </p>
      )}
      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
    </div>
  );
}

function SupplyModal({
  market,
  reserve,
  sender,
  walletClient,
  walletUsdcBalance,
  isBalanceLoading,
  onClose,
  onSuccess,
}: {
  market: Market;
  reserve: Reserve;
  sender: ReturnType<typeof evmAddress>;
  walletClient: WalletClient | undefined;
  walletUsdcBalance: string;
  isBalanceLoading?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [supply] = useSupply();
  const publicClient = usePublicClient();
  const [amount, setAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const permitSupported = reserve.permitSupported === true;

  const parsed = useMemo(() => {
    const n = Number.parseFloat(amount);
    return Number.isNaN(n) || n <= 0 ? null : n;
  }, [amount]);

  const handleMaxClick = useCallback(() => {
    setAmount(walletUsdcBalance);
  }, [walletUsdcBalance]);

  const sendAndWait = useCallback(
    async (tx: { to: string; data: string; value?: string }) => {
      if (!walletClient || !publicClient) throw new Error("Wallet or RPC not available");
      const valueBigInt = tx.value ? BigInt(tx.value) : 0n;
      const hash = await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: (tx.data || "0x") as `0x${string}`,
        value: valueBigInt,
        account: { address: sender, type: "json-rpc" },
        chain: publicClient.chain as never as import("viem").Chain,
      });
      await publicClient.waitForTransactionReceipt({
        hash,
        timeout: TX_CONFIRMATION_TIMEOUT_MS,
      });
      return hash;
    },
    [walletClient, publicClient, sender]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);
      if (parsed == null || !walletClient) return;
      if (!publicClient) {
        setErrorMessage("Network unavailable. Please try again.");
        return;
      }
      setIsSubmitting(true);
      try {
        const planResult = await supply({
          market: market.address,
          amount: {
            erc20: {
              currency: reserve.underlyingToken.address,
              value: bigDecimal(parsed),
            },
          },
          sender,
          chainId: AAVE_TARGET_CHAIN_ID,
        });

        if (planResult.isErr()) {
          const message = planResult.error?.message ?? "Supply failed";
          setErrorMessage(message);
          showTxErrorToast({ title: "Supply failed", description: message });
          return;
        }
        const plan = planResult.value;
        if (plan.__typename === "InsufficientBalanceError") {
          const message = `Insufficient balance. Required: ${plan.required?.value} USDC.`;
          setErrorMessage(message);
          showTxErrorToast({ title: "Supply failed", description: message });
          return;
        }
        let txHash: string | undefined;
        if (plan.__typename === "TransactionRequest") {
          txHash = await sendAndWait(plan);
        } else {
          await sendAndWait(plan.approval);
          txHash = await sendAndWait(plan.originalTransaction);
        }
        showTxSuccessToast({
          title: "Supply complete",
          description: `${formatUsd(parsed)} USDC supplied successfully.`,
          txHash,
        });
        onSuccess();
        onClose();
      } catch (err) {
        const message = normalizeTxErrorMessage(err, "Supply failed");
        setErrorMessage(message);
        showTxErrorToast({ title: "Supply failed", description: message });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      parsed,
      walletClient,
      publicClient,
      supply,
      sendAndWait,
      market.address,
      reserve.underlyingToken.address,
      sender,
      onSuccess,
      onClose,
    ]
  );

  const balanceDisplay = isBalanceLoading ? "Loading…" : parseFloat(walletUsdcBalance).toFixed(2);

  return (
    <Modal
      open
      title="Supply USDC"
      onClose={onClose}
      showCloseButton
      className="max-w-lg bg-white text-slate-900"
    >
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Amount (USDC)</span>
            <span className="text-xs text-slate-500">Available: {balanceDisplay} USDC</span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          />
          <button
            type="button"
            onClick={handleMaxClick}
            disabled={isBalanceLoading || !walletUsdcBalance || parseFloat(walletUsdcBalance) <= 0}
            className="text-primary w-fit text-xs font-medium hover:underline disabled:opacity-50"
          >
            Use max
          </button>
        </label>
        {permitSupported && (
          <p className="text-xs text-slate-500">
            This reserve supports Permit (EIP-2612). Members can sign a message to skip the approval
            transaction in a future update.
          </p>
        )}
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting || parsed == null}
            className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Processing…" : "Supply"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function WithdrawModal({
  market,
  reserve,
  supplyPosition,
  sender,
  walletClient,
  onClose,
  onSuccess,
}: {
  market: Market;
  reserve: Reserve;
  supplyPosition?: MarketUserReserveSupplyPosition;
  sender: ReturnType<typeof evmAddress>;
  walletClient: WalletClient | undefined;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [withdraw] = useWithdraw();
  const publicClient = usePublicClient();
  const [amount, setAmount] = useState("");
  const [useMax, setUseMax] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsed = useMemo(() => {
    if (useMax) return null;
    const n = Number.parseFloat(amount);
    return Number.isNaN(n) || n <= 0 ? null : n;
  }, [amount, useMax]);

  const sendAndWait = useCallback(
    async (tx: { to: string; data: string; value?: string }) => {
      if (!walletClient || !publicClient) throw new Error("Wallet or RPC not available");
      const valueBigInt = tx.value ? BigInt(tx.value) : 0n;
      const hash = await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: (tx.data || "0x") as `0x${string}`,
        value: valueBigInt,
        account: { address: sender, type: "json-rpc" },
        chain: publicClient.chain as never as import("viem").Chain,
      });
      await publicClient.waitForTransactionReceipt({
        hash,
        timeout: TX_CONFIRMATION_TIMEOUT_MS,
      });
      return hash;
    },
    [walletClient, publicClient, sender]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);
      if (!walletClient) return;
      if (!publicClient) {
        setErrorMessage("Network unavailable. Please try again.");
        return;
      }
      if (!useMax && parsed == null) return;
      setIsSubmitting(true);
      try {
        const planResult = await withdraw({
          market: market.address,
          amount: {
            erc20: {
              currency: reserve.underlyingToken.address,
              value: useMax ? { max: true } : { exact: bigDecimal(parsed!) },
            },
          },
          sender,
          chainId: AAVE_TARGET_CHAIN_ID,
        });
        if (planResult.isErr()) {
          const message = planResult.error?.message ?? "Withdraw failed";
          setErrorMessage(message);
          showTxErrorToast({ title: "Withdraw failed", description: message });
          return;
        }
        const plan = planResult.value;
        if (plan.__typename === "InsufficientBalanceError") {
          const message = `Insufficient balance. Required: ${plan.required?.value} USDC.`;
          setErrorMessage(message);
          showTxErrorToast({ title: "Withdraw failed", description: message });
          return;
        }
        let txHash: string | undefined;
        if (plan.__typename === "TransactionRequest") {
          txHash = await sendAndWait(plan);
        } else {
          await sendAndWait(plan.approval);
          txHash = await sendAndWait(plan.originalTransaction);
        }
        const amountLabel = useMax
          ? (supplyPosition?.balance?.amount?.value ?? "max")
          : String(parsed);
        showTxSuccessToast({
          title: "Withdraw complete",
          description: `${formatUsd(amountLabel)} USDC withdrawn successfully.`,
          txHash,
        });
        onSuccess();
        onClose();
      } catch (err) {
        const message = normalizeTxErrorMessage(err, "Withdraw failed");
        setErrorMessage(message);
        showTxErrorToast({ title: "Withdraw failed", description: message });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      useMax,
      parsed,
      walletClient,
      publicClient,
      withdraw,
      sendAndWait,
      supplyPosition?.balance?.amount?.value,
      market.address,
      reserve.underlyingToken.address,
      sender,
      onSuccess,
      onClose,
    ]
  );

  const balance = supplyPosition?.balance?.amount?.value ?? "0";
  const withdrawInputId = "withdraw-amount-usdc";

  const handleUseMax = useCallback(() => {
    setUseMax(true);
  }, []);

  return (
    <Modal
      open
      title="Withdraw USDC"
      onClose={onClose}
      showCloseButton
      className="max-w-lg bg-white text-slate-900"
    >
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <label htmlFor={withdrawInputId} className="text-xs font-medium text-slate-500">
            Amount (USDC) — Balance: {balance}
          </label>
          <input
            id={withdrawInputId}
            type="text"
            inputMode="decimal"
            value={useMax ? balance : amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setUseMax(false);
            }}
            placeholder="0"
            disabled={useMax}
            readOnly={useMax}
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-100"
            aria-label="Withdraw amount in USDC"
          />
          <button
            type="button"
            onClick={handleUseMax}
            className="text-primary min-h-[44px] w-fit cursor-pointer touch-manipulation self-start py-2 pr-3 pl-0 text-left text-xs font-medium hover:underline active:opacity-80"
            aria-label="Use maximum USDC balance"
          >
            Use max
          </button>
        </div>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting || (!useMax && parsed == null)}
            className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Processing…" : "Withdraw"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BorrowModal({
  market,
  reserve,
  sender,
  walletClient,
  availableBorrowUsd,
  onClose,
  onSuccess,
}: {
  market: Market;
  reserve: Reserve;
  sender: ReturnType<typeof evmAddress>;
  walletClient: WalletClient | undefined;
  availableBorrowUsd?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [borrow] = useBorrow();
  const publicClient = usePublicClient();
  const [amount, setAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsed = useMemo(() => {
    const n = Number.parseFloat(amount);
    return Number.isNaN(n) || n <= 0 ? null : n;
  }, [amount]);

  const handleMaxClick = useCallback(() => {
    if (availableBorrowUsd != null && availableBorrowUsd > 0) {
      setAmount(String(availableBorrowUsd));
    }
  }, [availableBorrowUsd]);

  const sendAndWait = useCallback(
    async (tx: { to: string; data: string; value?: string }) => {
      if (!walletClient || !publicClient) throw new Error("Wallet or RPC not available");
      const valueBigInt = tx.value ? BigInt(tx.value) : 0n;
      const hash = await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: (tx.data || "0x") as `0x${string}`,
        value: valueBigInt,
        account: { address: sender, type: "json-rpc" },
        chain: publicClient.chain as never as import("viem").Chain,
      });
      await publicClient.waitForTransactionReceipt({
        hash,
        timeout: TX_CONFIRMATION_TIMEOUT_MS,
      });
      return hash;
    },
    [walletClient, publicClient, sender]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);
      if (parsed == null || !walletClient) return;
      if (!publicClient) {
        setErrorMessage("Network unavailable. Please try again.");
        return;
      }
      setIsSubmitting(true);
      try {
        const planResult = await borrow({
          market: market.address,
          amount: {
            erc20: {
              currency: reserve.underlyingToken.address,
              value: bigDecimal(parsed),
            },
          },
          sender,
          chainId: AAVE_TARGET_CHAIN_ID,
        });
        if (planResult.isErr()) {
          const message = planResult.error?.message ?? "Borrow failed";
          setErrorMessage(message);
          showTxErrorToast({ title: "Borrow failed", description: message });
          return;
        }
        const plan = planResult.value;
        if (plan.__typename === "InsufficientBalanceError") {
          const message = `Insufficient balance. Required: ${plan.required?.value} USDC.`;
          setErrorMessage(message);
          showTxErrorToast({ title: "Borrow failed", description: message });
          return;
        }
        let txHash: string | undefined;
        if (plan.__typename === "TransactionRequest") {
          txHash = await sendAndWait(plan);
        } else {
          await sendAndWait(plan.approval);
          txHash = await sendAndWait(plan.originalTransaction);
        }
        showTxSuccessToast({
          title: "Borrow complete",
          description: `${formatUsd(parsed)} USDC borrowed successfully.`,
          txHash,
        });
        onSuccess();
        onClose();
      } catch (err) {
        const message = normalizeTxErrorMessage(err, "Borrow failed");
        setErrorMessage(message);
        showTxErrorToast({ title: "Borrow failed", description: message });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      parsed,
      walletClient,
      publicClient,
      borrow,
      sendAndWait,
      market.address,
      reserve.underlyingToken.address,
      sender,
      onSuccess,
      onClose,
    ]
  );

  return (
    <Modal
      open
      title="Borrow USDC"
      onClose={onClose}
      showCloseButton
      className="max-w-lg bg-white text-slate-900"
    >
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        {availableBorrowUsd != null && availableBorrowUsd > 0 && (
          <p className="text-sm text-slate-600" role="status">
            Available to borrow:{" "}
            <span className="font-medium text-slate-900">{formatUsd(availableBorrowUsd)} USDC</span>
          </p>
        )}
        <label className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Amount (USDC)</span>
            {availableBorrowUsd != null && availableBorrowUsd > 0 && (
              <span className="text-xs text-slate-500">Max: {formatUsd(availableBorrowUsd)}</span>
            )}
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
            aria-label="Borrow amount in USDC"
          />
          {availableBorrowUsd != null && availableBorrowUsd > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleMaxClick();
              }}
              className="text-primary -mb-1 min-h-[44px] w-fit cursor-pointer touch-manipulation self-start py-2 pr-2 text-left text-xs font-medium hover:underline"
              aria-label="Use maximum available to borrow"
            >
              Use max
            </button>
          )}
        </label>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting || parsed == null}
            className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Processing…" : "Borrow"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

type RepayForMode = "self" | "other";

function RepayModal({
  market,
  reserve,
  borrowPosition,
  sender,
  walletClient,
  onClose,
  onSuccess,
}: {
  market: Market;
  reserve: Reserve;
  borrowPosition?: MarketUserReserveBorrowPosition;
  sender: ReturnType<typeof evmAddress>;
  walletClient: WalletClient | undefined;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [repayForMode, setRepayForMode] = useState<RepayForMode>("self");
  const [otherBorrowerAddress, setOtherBorrowerAddress] = useState("");
  const [repay] = useRepay();
  const publicClient = usePublicClient();
  const [amount, setAmount] = useState("");
  const [useMax, setUseMax] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otherBorrowerEvm = useMemo(() => {
    if (
      repayForMode !== "other" ||
      !otherBorrowerAddress.trim() ||
      !isAddress(otherBorrowerAddress.trim())
    )
      return null;
    return evmAddress(otherBorrowerAddress.trim());
  }, [repayForMode, otherBorrowerAddress]);

  const marketsInput = useMemo(
    () => [{ address: market.address, chainId: AAVE_TARGET_CHAIN_ID }],
    [market.address]
  );

  const { data: otherBorrows = [] } = useUserBorrows({
    markets: marketsInput,
    user: otherBorrowerEvm ?? evmAddress("0x0000000000000000000000000000000000000000"),
  });

  const otherUsdcBorrowPosition = useMemo(
    () => otherBorrows.find((b) => b.currency?.symbol?.toUpperCase() === "USDC"),
    [otherBorrows]
  );

  const positionToRepay = repayForMode === "self" ? borrowPosition : otherUsdcBorrowPosition;
  const debt = positionToRepay?.debt?.amount?.value ?? "0";
  const canRepayOther = repayForMode === "other" && otherBorrowerEvm != null && Number(debt) > 0;

  const parsed = useMemo(() => {
    if (useMax) return null;
    const n = Number.parseFloat(amount);
    return Number.isNaN(n) || n <= 0 ? null : n;
  }, [amount, useMax]);

  const sendAndWait = useCallback(
    async (tx: { to: string; data: string; value?: string }) => {
      if (!walletClient || !publicClient) throw new Error("Wallet or RPC not available");
      const valueBigInt = tx.value ? BigInt(tx.value) : 0n;
      const hash = await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: (tx.data || "0x") as `0x${string}`,
        value: valueBigInt,
        account: { address: sender, type: "json-rpc" },
        chain: publicClient.chain as never as import("viem").Chain,
      });
      await publicClient.waitForTransactionReceipt({
        hash,
        timeout: TX_CONFIRMATION_TIMEOUT_MS,
      });
      return hash;
    },
    [walletClient, publicClient, sender]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);
      if (!walletClient) return;
      if (!publicClient) {
        setErrorMessage("Network unavailable. Please try again.");
        return;
      }
      if (repayForMode === "other" && !otherBorrowerEvm) {
        setErrorMessage("Enter a valid borrower address.");
        return;
      }
      if (!useMax && parsed == null) return;
      if (repayForMode === "other" && !canRepayOther) return;
      setIsSubmitting(true);
      try {
        const planResult = await repay({
          market: market.address,
          amount: {
            erc20: {
              currency: reserve.underlyingToken.address,
              value: useMax ? { max: true } : { exact: bigDecimal(parsed!) },
            },
          },
          sender,
          chainId: AAVE_TARGET_CHAIN_ID,
          ...(repayForMode === "other" && otherBorrowerEvm && { onBehalfOf: otherBorrowerEvm }),
        });
        if (planResult.isErr()) {
          const message = planResult.error?.message ?? "Repay failed";
          setErrorMessage(message);
          showTxErrorToast({ title: "Repay failed", description: message });
          return;
        }
        const plan = planResult.value;
        if (plan.__typename === "InsufficientBalanceError") {
          const message = `Insufficient balance. Required: ${plan.required?.value} USDC.`;
          setErrorMessage(message);
          showTxErrorToast({ title: "Repay failed", description: message });
          return;
        }
        let txHash: string | undefined;
        if (plan.__typename === "TransactionRequest") {
          txHash = await sendAndWait(plan);
        } else {
          await sendAndWait(plan.approval);
          txHash = await sendAndWait(plan.originalTransaction);
        }
        const amountLabel = useMax ? debt : String(parsed);
        showTxSuccessToast({
          title: "Repay complete",
          description: `${formatUsd(amountLabel)} USDC repaid successfully.`,
          txHash,
        });
        onSuccess();
        onClose();
      } catch (err) {
        const message = normalizeTxErrorMessage(err, "Repay failed");
        setErrorMessage(message);
        showTxErrorToast({ title: "Repay failed", description: message });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      repayForMode,
      otherBorrowerEvm,
      useMax,
      parsed,
      canRepayOther,
      walletClient,
      publicClient,
      repay,
      sendAndWait,
      debt,
      market.address,
      reserve.underlyingToken.address,
      sender,
      onSuccess,
      onClose,
    ]
  );

  const submitDisabled =
    isSubmitting || (!useMax && parsed == null) || (repayForMode === "other" && !canRepayOther);

  return (
    <Modal
      open
      title="Repay USDC"
      onClose={onClose}
      showCloseButton
      className="max-w-lg bg-white text-slate-900"
    >
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-slate-700">Repay from</p>
          <div className="flex gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="repayForMode"
                checked={repayForMode === "self"}
                onChange={() => {
                  setRepayForMode("self");
                  setErrorMessage(null);
                }}
                className="text-primary focus:ring-primary h-4 w-4 border-slate-300"
                aria-label="Repay my own debt"
              />
              <span className="text-sm text-slate-900">My wallet (this debt)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="repayForMode"
                checked={repayForMode === "other"}
                onChange={() => {
                  setRepayForMode("other");
                  setErrorMessage(null);
                }}
                className="text-primary focus:ring-primary h-4 w-4 border-slate-300"
                aria-label="Repay for another address"
              />
              <span className="text-sm text-slate-900">Another wallet</span>
            </label>
          </div>
        </div>

        {repayForMode === "other" && (
          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-slate-500">
              Borrower address (whose debt to repay)
            </span>
            <input
              type="text"
              value={otherBorrowerAddress}
              onChange={(e) => setOtherBorrowerAddress(e.target.value)}
              placeholder="0x…"
              className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400"
              aria-label="Borrower address"
            />
            {otherBorrowerAddress.trim() && !isAddress(otherBorrowerAddress.trim()) && (
              <p className="text-xs text-amber-600">Enter a valid Ethereum address.</p>
            )}
          </label>
        )}

        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium text-slate-500">
            {repayForMode === "self" ? "Amount (USDC) — Debt: " : "Amount (USDC) — Their debt: "}
            {debt}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setUseMax(false);
            }}
            placeholder="0"
            disabled={useMax}
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-100"
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setUseMax(true);
            }}
            disabled={repayForMode === "other" && !canRepayOther}
            className="text-primary -mb-1 min-h-[44px] w-fit cursor-pointer touch-manipulation self-start py-2 pr-2 text-left text-xs font-medium hover:underline disabled:opacity-50"
            aria-label="Repay maximum USDC debt"
          >
            Repay max
          </button>
        </label>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitDisabled}
            className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Processing…" : "Repay"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
