"use client";

import { useState, useMemo, useCallback } from "react";
import { Address, formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import type { Vault } from "@aave/react";
import { AaveVaultModal } from "@/components/vaults/AaveVaultModal";
import { VaultManagementModal } from "@/components/vaults/VaultManagementModal";
import { VaultActivityModal } from "@/components/vaults/VaultActivityModal";
import { NexusCoverModal } from "@/components/nexus/NexusCoverModal";
import { StrategyCard } from "@/components/strategies/StrategyCard";
import { NEXUS_AAVE_V3_PRODUCT_ID } from "@/lib/config/nexus-mutual";
import { useBaseUsdcReserve } from "@/hooks/useBaseUsdcReserve";
import { formatPercent } from "@/lib/formatters";
import { formatVaultShares } from "@/lib/yearnUtils";
import { USDC_ADDRESS_BASE } from "@/lib/config/yearn";
import Link from "next/link";

// ERC-4626 ABI for reading vault data
const ERC4626_ABI = [
  {
    inputs: [],
    name: "totalAssets",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "asset",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

type DeployedVaultCardProps = {
  vault?: Vault | null;
  vaultAddress: Address;
  assetAddress: Address;
  assetSymbol?: string;
  assetDecimals?: number;
  name?: string;
  transactionHash?: string;
  performanceFee?: number; // Performance fee in percentage (e.g., 12 for 12%)
  isApiOwned?: boolean; // True when the Aave API returned this vault in the ownedBy query
};

export const DeployedVaultCard = ({
  vault: vaultFromApi,
  vaultAddress,
  assetAddress,
  assetSymbol = "USDC",
  assetDecimals = 6,
  name,
  transactionHash,
  performanceFee,
  isApiOwned = false,
}: DeployedVaultCardProps) => {
  const { address: wagmiAddress } = useAccount();
  const { wallet: crossmintWallet } = useWallet();

  // Determine active address (Crossmint takes priority, fallback to wagmi)
  // This must match the logic in YearnVaultModal to ensure balance checks use the same address
  const userAddress = useMemo(() => {
    if (crossmintWallet?.address) {
      return crossmintWallet.address as `0x${string}`;
    }
    return wagmiAddress;
  }, [crossmintWallet?.address, wagmiAddress]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"deposit" | "withdraw">("deposit");
  const [managementModalOpen, setManagementModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [coverModalOpen, setCoverModalOpen] = useState(false);

  // When vault is from API, use its usedReserve; otherwise fall back to Base USDC reserve
  const { reserve: baseReserve, loading: reserveLoading } = useBaseUsdcReserve();
  const reserve = vaultFromApi?.usedReserve ?? baseReserve;
  const aTokenAddress = (reserve?.aToken?.address ?? baseReserve?.aToken?.address) as
    | Address
    | undefined;

  // Get vault TVL from ERC-4626 totalAssets (this includes accrued interest)
  const { data: totalAssets, isLoading: vaultLoading } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "totalAssets",
    chainId: 8453, // Base mainnet
    query: {
      refetchInterval: 30000, // Refetch every 30 seconds to see interest accrue
    },
  });

  // Get vault's aToken balance (shows the actual aToken amount held)
  const { data: aTokenBalance } = useReadContract({
    address: aTokenAddress,
    abi: [
      {
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "balanceOf",
    args: vaultAddress ? [vaultAddress] : undefined,
    chainId: 8453, // Base mainnet
    query: {
      enabled: !!aTokenAddress && !!vaultAddress,
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // Get vault asset address
  const { data: vaultAssetAddress } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "asset",
    chainId: 8453, // Base mainnet
  });

  // Get user's share balance
  const {
    data: shareBalance,
    isLoading: isShareBalanceLoading,
    refetch: refetchShareBalance,
  } = useReadContract({
    address: vaultAddress,
    abi: [
      {
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    chainId: 8453, // Base mainnet
    query: {
      enabled: !!userAddress,
      refetchInterval: 10000, // Refetch every 10 seconds to keep share balance fresh
    },
  });

  // Read vault share token decimals (ERC-20 `decimals()`).
  // For TokenizedStrategy-based vaults, this is set from the underlying asset decimals.
  // This is required for correct share formatting and share<->asset conversion.
  const { data: shareDecimalsRaw } = useReadContract({
    address: vaultAddress,
    abi: [
      {
        inputs: [],
        name: "decimals",
        outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "decimals",
    chainId: 8453, // Base mainnet
    query: {
      enabled: !!vaultAddress,
    },
  });

  const shareDecimals = shareDecimalsRaw != null ? Number(shareDecimalsRaw) : undefined;

  // Read on-chain owner for fallback ownership check (when API data is unavailable)
  const { data: onChainOwner } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "owner",
    chainId: 8453,
  });

  // When deployed via Crossmint (account abstraction), the vault's on-chain owner is the
  // Crossmint smart wallet contract, not the user's address. Check if that intermediate
  // contract's owner() resolves to the user (i.e. user → smart wallet → vault).
  const { data: smartWalletOwner } = useReadContract({
    address: onChainOwner as Address | undefined,
    abi: ERC4626_ABI,
    functionName: "owner",
    chainId: 8453,
    query: {
      enabled:
        !!onChainOwner &&
        !!userAddress &&
        typeof onChainOwner === "string" &&
        onChainOwner.toLowerCase() !== userAddress.toLowerCase(),
    },
  });

  // If onchain `balanceOf(user)` is temporarily stale/0 after deposits, use Aave's API-provided
  // `userShares` as a fallback so the UI can still enable withdrawals.
  const apiShareBalance = useMemo((): bigint | undefined => {
    if (shareDecimals == null) return undefined;
    const apiValue = (vaultFromApi as any)?.userShares?.shares?.amount?.value as string | undefined;
    if (!apiValue) return undefined;

    try {
      return parseUnits(String(apiValue), shareDecimals);
    } catch {
      return undefined;
    }
  }, [vaultFromApi, shareDecimals]);

  const resolvedShareBalance = useMemo((): bigint | undefined => {
    if (shareBalance !== undefined && shareBalance > 0n) return shareBalance;
    if (apiShareBalance !== undefined && apiShareBalance > 0n) return apiShareBalance;
    return shareBalance;
  }, [shareBalance, apiShareBalance]);

  const resolvedShareBalanceForConvertToAssets = useMemo(() => {
    if (resolvedShareBalance === undefined || resolvedShareBalance === 0n) return undefined;
    return resolvedShareBalance;
  }, [resolvedShareBalance]);

  // Calculate user's asset value from shares
  const { data: convertToAssets } = useReadContract({
    address: vaultAddress,
    abi: [
      {
        inputs: [{ internalType: "uint256", name: "shares", type: "uint256" }],
        name: "convertToAssets",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "convertToAssets",
    args: resolvedShareBalanceForConvertToAssets
      ? [resolvedShareBalanceForConvertToAssets]
      : undefined,
    chainId: 8453, // Base mainnet
    query: {
      enabled: resolvedShareBalanceForConvertToAssets !== undefined,
    },
  });

  // Use the actual asset address from vault if available, with USDC_ADDRESS_BASE as final fallback
  // This ensures we always have a valid address for balance queries
  const actualAssetAddress = useMemo(() => {
    return (vaultAssetAddress || assetAddress || USDC_ADDRESS_BASE) as Address;
  }, [vaultAssetAddress, assetAddress]);

  // Get user's asset balance (USDC balance for deposits)
  const {
    data: userAssetBalance,
    refetch: refetchAssetBalance,
    isLoading: isBalanceLoading,
  } = useReadContract({
    address: actualAssetAddress,
    abi: [
      {
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    chainId: 8453, // Base mainnet
    query: {
      enabled: !!actualAssetAddress && !!userAddress,
      refetchInterval: 10000, // Refetch every 10 seconds to keep balance updated
    },
  });

  const handleOpenDeposit = useCallback(() => {
    setModalMode("deposit");
    setModalOpen(true);
    // Refetch balance when opening deposit modal to ensure accurate balance
    if (refetchAssetBalance) {
      refetchAssetBalance();
    }
  }, [refetchAssetBalance]);

  const handleOpenWithdraw = useCallback(() => {
    setModalMode("withdraw");
    setModalOpen(true);
    // Ensure `balanceOf(user)` is fresh so the withdraw form shows correct balances.
    if (refetchShareBalance) refetchShareBalance();
  }, [refetchShareBalance]);

  const handleVaultSuccess = useCallback(() => {
    refetchAssetBalance?.();
    refetchShareBalance?.();
  }, [refetchAssetBalance, refetchShareBalance]);

  // Calculate net APR from Aave reserve (after performance fee)
  // Use .formatted when present (percent string e.g. "2.20"); .value may be decimal (0.022) so scale by 100
  const aprDisplay = useMemo(() => {
    if (reserveLoading || !reserve) return "Loading...";

    const apy = reserve.supplyInfo.apy;
    const formatted = apy?.formatted;
    const valueRaw = apy?.value;

    let grossPercent: number;
    if (formatted != null && formatted !== "") {
      grossPercent =
        typeof formatted === "string" ? Number.parseFloat(formatted) : Number(formatted);
    } else if (valueRaw != null) {
      const num = typeof valueRaw === "string" ? Number.parseFloat(valueRaw) : Number(valueRaw);
      if (Number.isNaN(num)) return "—";
      // Aave .value is often decimal (0.022 = 2.2%); if in 0–1 range treat as decimal
      grossPercent = num > 0 && num <= 1 ? num * 100 : num;
    } else {
      return "—";
    }

    if (Number.isNaN(grossPercent)) return "—";

    // If we have the performance fee, calculate net APR
    // Aave Labs takes 50% of the performance fee, so:
    // Net APR = Gross APR * (1 - (performanceFee / 2) / 100)
    if (performanceFee !== undefined && performanceFee > 0) {
      const feeDecimal = performanceFee / 100;
      const aaveLabsFeeShare = feeDecimal / 2;
      const netPercent = grossPercent * (1 - aaveLabsFeeShare);
      return formatPercent(netPercent);
    }

    return formatPercent(grossPercent);
  }, [reserve, reserveLoading, performanceFee]);

  const tvlDisplay = vaultLoading
    ? "Loading..."
    : totalAssets
      ? `$${Number(formatUnits(totalAssets, assetDecimals)).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "—";

  // Calculate accrued interest
  // totalAssets already includes interest, but we can show the aToken balance for transparency
  const aTokenBalanceDisplay = useMemo(() => {
    if (!aTokenBalance || !aTokenAddress) return null;

    const balance = Number(formatUnits(aTokenBalance, assetDecimals));
    return balance.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }, [aTokenBalance, aTokenAddress, assetDecimals]);

  // Calculate interest accrued (difference between aToken balance and underlying)
  // Note: totalAssets already accounts for interest, but we can show the aToken amount
  const interestInfo = useMemo(() => {
    if (!totalAssets || !aTokenBalance) return null;

    // The aToken balance represents the claimable underlying amount (including interest)
    // totalAssets should match this, but we can show both for transparency
    const totalAssetsNum = Number(formatUnits(totalAssets, assetDecimals));
    const aTokenBalanceNum = Number(formatUnits(aTokenBalance, assetDecimals));

    // If there's a difference, it's likely due to rounding or the way Aave calculates
    // For now, we'll show the aToken balance as the "earning balance"
    return {
      aTokenBalance: aTokenBalanceNum,
      totalAssets: totalAssetsNum,
    };
  }, [totalAssets, aTokenBalance, assetDecimals]);

  // Check if user has a position (shares > 0)
  // Only consider hasPosition true if we've loaded the balance and it's > 0
  const hasPosition =
    resolvedShareBalance !== undefined &&
    resolvedShareBalance > 0n &&
    // If we have the onchain conversion value, ensure it doesn't exceed total vault assets
    // (sanity check against parsing/shape mismatches in `apiShareBalance`).
    (convertToAssets !== undefined && totalAssets !== undefined
      ? convertToAssets <= totalAssets
      : true) &&
    !isShareBalanceLoading;

  // Disable withdraw button only if:
  // 1. No wallet connected, OR
  // 2. We've finished loading AND confirmed user has no shares
  // Keep button enabled during loading to avoid showing inactive state when user actually has shares
  const isWithdrawDisabled = !userAddress || (!isShareBalanceLoading && !hasPosition);

  const positionValue =
    hasPosition && convertToAssets ? formatUnits(convertToAssets, assetDecimals) : "0";

  const displayName = name || `My Aave Vault`;

  const isOwner =
    !!userAddress &&
    (isApiOwned ||
      vaultFromApi?.owner?.toLowerCase() === userAddress.toLowerCase() ||
      (typeof onChainOwner === "string" &&
        onChainOwner.toLowerCase() === userAddress.toLowerCase()) ||
      (typeof smartWalletOwner === "string" &&
        smartWalletOwner.toLowerCase() === userAddress.toLowerCase()));

  const cardActions = useMemo(() => {
    const actions: Array<{
      id: string;
      label: string;
      ariaLabel: string;
      onClick: () => void;
      disabled?: boolean;
    }> = [
      {
        id: "deposit",
        label: hasPosition ? "Add Funds" : "Deposit",
        ariaLabel: "Deposit into vault",
        onClick: handleOpenDeposit,
      },
      {
        id: "withdraw",
        label: "Withdraw",
        ariaLabel: "Withdraw from vault",
        onClick: handleOpenWithdraw,
        disabled: isWithdrawDisabled,
      },
      {
        id: "view-vault",
        label: "View on Basescan",
        ariaLabel: "View vault on Basescan",
        onClick: () =>
          window.open(
            `https://basescan.org/address/${vaultAddress}`,
            "_blank",
            "noopener,noreferrer"
          ),
      },
    ];
    if (isOwner) {
      actions.splice(2, 0, {
        id: "manage",
        label: "Manage",
        ariaLabel: "Manage vault (fee, withdraw fees, transfer ownership)",
        onClick: () => setManagementModalOpen(true),
      });
    }
    if (hasPosition) {
      actions.splice(
        actions.findIndex((a) => a.id === "view-vault"),
        0,
        {
          id: "buy-cover",
          label: "Buy Cover",
          ariaLabel: "Protect position with Nexus Mutual cover",
          onClick: () => setCoverModalOpen(true),
        }
      );
      actions.splice(
        actions.findIndex((a) => a.id === "view-vault"),
        0,
        {
          id: "activity",
          label: "Activity",
          ariaLabel: "View vault activity and history",
          onClick: () => setActivityModalOpen(true),
        }
      );
    }
    return actions;
  }, [
    hasPosition,
    handleOpenDeposit,
    handleOpenWithdraw,
    isWithdrawDisabled,
    vaultAddress,
    isOwner,
  ]);

  return (
    <>
      <StrategyCard
        title={displayName}
        subtitle="Your deployed Aave USDC Earn Vault"
        apr={aprDisplay}
        tvl={tvlDisplay}
        description="Your custom ERC-4626 vault deployed on Base, sourcing yield from the Aave USDC reserve."
        actions={cardActions}
        footnote={
          <div className="flex flex-col gap-1 text-xs text-slate-500">
            <div>
              <span className="font-semibold">Vault Address: </span>
              <Link
                href={`https://basescan.org/address/${vaultAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all underline"
              >
                {vaultAddress}
              </Link>
            </div>
            {transactionHash && (
              <div>
                <span className="font-semibold">Deployment TX: </span>
                <Link
                  href={`https://basescan.org/tx/${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {transactionHash.slice(0, 10)}...
                </Link>
              </div>
            )}
            {hasPosition && (
              <div className="mt-1 text-slate-600">
                Your Position:{" "}
                {Number(positionValue).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}{" "}
                {assetSymbol} ({formatVaultShares(resolvedShareBalance ?? 0n, shareDecimals ?? 18)}{" "}
                shares)
              </div>
            )}
            {aTokenBalanceDisplay && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-900">aBaseUSDC Balance:</span>
                  <span className="font-mono text-emerald-700">
                    {aTokenBalanceDisplay} aBaseUSDC
                  </span>
                </div>
                <div className="mt-1 text-xs text-emerald-700">
                  💰 Interest accruing in real-time on Aave
                </div>
                {aTokenAddress && (
                  <Link
                    href={`https://basescan.org/address/${aTokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-xs text-emerald-600 underline"
                  >
                    View aToken on Basescan
                  </Link>
                )}
              </div>
            )}
          </div>
        }
      />

      <AaveVaultModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        vaultAddress={vaultAddress}
        assetAddress={actualAssetAddress}
        assetSymbol={assetSymbol}
        assetDecimals={assetDecimals}
        shareDecimals={shareDecimals}
        mode={modalMode}
        userAddress={userAddress ?? undefined}
        userAssetBalance={(userAssetBalance as bigint) ?? 0n}
        shareBalance={resolvedShareBalance ?? 0n}
        isBalanceLoading={isBalanceLoading}
        onSuccess={handleVaultSuccess}
      />

      {isOwner && (
        <VaultManagementModal
          open={managementModalOpen}
          onClose={() => setManagementModalOpen(false)}
          vault={vaultFromApi ?? ({ address: vaultAddress, chainId: 8453 } as unknown as Vault)}
          feeManagerAddress={
            typeof onChainOwner === "string" &&
            onChainOwner.toLowerCase() !== userAddress?.toLowerCase()
              ? (onChainOwner as Address)
              : undefined
          }
        />
      )}

      <VaultActivityModal
        open={activityModalOpen}
        onClose={() => setActivityModalOpen(false)}
        vaultAddress={vaultAddress}
        chainId={8453}
        userAddress={userAddress ?? undefined}
        assetSymbol={assetSymbol}
        currentAssetValueWei={convertToAssets ?? undefined}
        assetDecimals={assetDecimals}
      />

      <NexusCoverModal
        open={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        productId={NEXUS_AAVE_V3_PRODUCT_ID}
        productLabel="Aave v3"
        assetSymbol={assetSymbol}
        assetDecimals={assetDecimals ?? 6}
        suggestedAmountWei={convertToAssets ?? undefined}
        buyerAddress={userAddress ?? undefined}
      />
    </>
  );
};
