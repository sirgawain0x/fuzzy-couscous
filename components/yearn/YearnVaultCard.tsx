"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Address, formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { BASE_BLOCK_EXPLORER_ADDRESS_URL } from "@/lib/config/yearn";
import { YearnVaultModal } from "./YearnVaultModal";
import { NexusCoverModal } from "@/components/nexus/NexusCoverModal";
import { StrategyCard } from "@/components/strategies/StrategyCard";
import { NEXUS_YEARN_V3_PRODUCT_ID } from "@/lib/config/nexus-mutual";
import { useNexusCoverStatus } from "@/hooks/useNexusCoverStatus";
import { useYearnVault, useYearnVaultBalance } from "@/hooks/useYearnVaults";
import { useKalaniDepositEligibility } from "@/hooks/useKalaniDepositEligibility";
import { formatPercentage, formatVaultShares } from "@/lib/yearnUtils";
import { YearnVaultInterestModal } from "./YearnVaultInterestModal";

type YearnVaultCardProps = {
  vaultAddress: Address;
  assetAddress: Address;
  assetSymbol?: string;
  assetDecimals?: number;
  name: string;
  description: string;
  estimatedApr?: number;
  userAssetBalance?: bigint;
  /** When set, deposit is gated by bouncer (availableDepositLimit). */
  bouncerAddress?: Address;
};

export const YearnVaultCard = ({
  vaultAddress,
  assetAddress,
  assetSymbol = "USDC",
  assetDecimals = 6,
  name,
  description,
  estimatedApr,
  userAssetBalance = 0n,
  bouncerAddress,
}: YearnVaultCardProps) => {
  const { address: wagmiAddress } = useAccount();
  const { wallet: crossmintWallet } = useWallet();
  const userAddress = useMemo(() => {
    if (crossmintWallet?.address) return crossmintWallet.address as `0x${string}`;
    return wagmiAddress ?? undefined;
  }, [crossmintWallet?.address, wagmiAddress]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"deposit" | "withdraw">("deposit");
  const [coverModalOpen, setCoverModalOpen] = useState(false);
  const [interestModalOpen, setInterestModalOpen] = useState(false);

  // Check if user has active Nexus Mutual cover for this vault
  const coverStatus = useNexusCoverStatus(NEXUS_YEARN_V3_PRODUCT_ID, userAddress);

  const { isEligible: canDepositByBouncer, isLoading: bouncerLoading } =
    useKalaniDepositEligibility(bouncerAddress);

  // Get vault details
  const { totalAssets, isLoading: vaultLoading } = useYearnVault(vaultAddress);

  // Read vault share token decimals (ERC-20 decimals()) so share display matches USDC scale
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
    chainId: 8453,
    query: { enabled: !!vaultAddress },
  });
  const shareDecimals = shareDecimalsRaw != null ? Number(shareDecimalsRaw) : 18;

  // Get user's position
  const { shareBalance, assetValue } = useYearnVaultBalance(vaultAddress, userAddress);

  const depositDisabled = Boolean(bouncerAddress && (bouncerLoading || !canDepositByBouncer));
  const depositTitle =
    bouncerAddress && !canDepositByBouncer && !bouncerLoading
      ? "Kalani Vault is for members only. Get a Creative Brand, Investor, or Creator NFT to deposit."
      : undefined;

  const handleOpenDeposit = useCallback(() => {
    if (depositDisabled) return;
    setModalMode("deposit");
    setModalOpen(true);
  }, [depositDisabled]);

  const handleOpenWithdraw = useCallback(() => {
    setModalMode("withdraw");
    setModalOpen(true);
  }, []);

  const tvlDisplay = vaultLoading
    ? "Loading..."
    : totalAssets
      ? `$${Number(formatUnits(totalAssets, assetDecimals)).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "—";

  const aprDisplay = formatPercentage(estimatedApr);

  const hasPosition = shareBalance && shareBalance > 0n;
  const positionValue = hasPosition && assetValue ? formatUnits(assetValue, assetDecimals) : "0";

  return (
    <>
      <StrategyCard
        title={name}
        subtitle={`ERC-4626 Yearn V3 Vault • ${assetSymbol}${coverStatus.hasCover ? " • 🛡️ Covered" : ""}`}
        apr={aprDisplay}
        tvl={tvlDisplay}
        description={description}
        actions={[
          {
            id: "deposit",
            label: bouncerLoading ? "Checking access…" : "Deposit",
            ariaLabel: `Deposit ${assetSymbol} into ${name}`,
            onClick: handleOpenDeposit,
            disabled: depositDisabled,
            title: depositTitle,
          },
          {
            id: "view-basescan",
            label: "View on Basescan",
            ariaLabel: `View ${name} vault contract on Basescan`,
            onClick: () =>
              window.open(
                `${BASE_BLOCK_EXPLORER_ADDRESS_URL}/${vaultAddress}`,
                "_blank",
                "noopener,noreferrer"
              ),
          },
          ...(hasPosition
            ? [
                {
                  id: "withdraw",
                  label: "Withdraw",
                  ariaLabel: `Withdraw ${assetSymbol} from ${name}`,
                  onClick: handleOpenWithdraw,
                },
                {
                  id: "buy-cover",
                  label: "Buy Cover",
                  ariaLabel: "Protect position with Nexus Mutual cover",
                  onClick: () => setCoverModalOpen(true),
                },
                {
                  id: "interest",
                  label: "Interest",
                  ariaLabel: "View net profit and interest over time",
                  onClick: () => setInterestModalOpen(true),
                },
              ]
            : []),
        ]}
        footnote={
          <div className="flex flex-col gap-2 text-xs text-slate-500">
            <div>
              <span className="font-semibold text-slate-700">Vault address: </span>
              <Link
                href={`${BASE_BLOCK_EXPLORER_ADDRESS_URL}/${vaultAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-slate-600 underline underline-offset-2 hover:text-slate-900"
              >
                {vaultAddress}
              </Link>
            </div>
            {hasPosition ? (
              <div className="flex flex-col gap-1 border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-900">Your position</span>
                <p>
                  {formatVaultShares(shareBalance, shareDecimals)} shares ≈ {positionValue}{" "}
                  {assetSymbol}
                </p>
              </div>
            ) : (
              <p>
                Fully ERC-4626 compliant. Deposits use Yearn&apos;s V3 multi-strategy architecture.
              </p>
            )}
          </div>
        }
      />

      <YearnVaultModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        vaultAddress={vaultAddress}
        assetAddress={assetAddress}
        assetSymbol={assetSymbol}
        mode={modalMode}
        userAssetBalance={userAssetBalance}
        assetDecimals={assetDecimals}
        shareDecimals={shareDecimals}
      />

      <NexusCoverModal
        open={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        productId={NEXUS_YEARN_V3_PRODUCT_ID}
        productLabel="Yearn v3"
        assetSymbol={assetSymbol}
        assetDecimals={assetDecimals}
        suggestedAmountWei={assetValue ?? undefined}
        buyerAddress={userAddress}
      />

      <YearnVaultInterestModal
        open={interestModalOpen}
        onClose={() => setInterestModalOpen(false)}
        vaultAddress={vaultAddress}
        userAddress={userAddress}
        assetSymbol={assetSymbol}
        assetDecimals={assetDecimals}
      />
    </>
  );
};
