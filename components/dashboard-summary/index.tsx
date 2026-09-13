import Image from "next/image";
import { WalletBalance } from "./WalletBalance";
import { DepositButton } from "../common/DepositButton";
import { Container } from "../common/Container";
import {
  ArrowsRightLeftIcon,
  WalletIcon,
  ArrowUpRightIcon,
  EllipsisVerticalIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { Dropdown } from "../common/Dropdown";
import { useState, useEffect, useRef } from "react";
import { WalletDetails } from "./WalletDetails";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { WarningModal } from "./WarningModal";
import createCoinbaseSessionToken from "@/server-actions/createCoinbaseSessionToken";
import { checkCoinbaseConfig } from "@/server-actions/checkCoinbaseConfig";
import { EarningsReport } from "@/components/reports/EarningsReport";

interface DashboardSummaryProps {
  onDepositClick: () => void;
  onSendClick: () => void;
}

export function DashboardSummary({ onDepositClick, onSendClick }: DashboardSummaryProps) {
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const { wallet } = useWallet();
  const { user } = useAuth();
  const [openWarningModal, setOpenWarningModal] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalStatus, setWithdrawalStatus] = useState<string | null>(null);
  const withdrawalStatusRef = useRef(withdrawalStatus);

  // Keep ref in sync with state
  useEffect(() => {
    withdrawalStatusRef.current = withdrawalStatus;
  }, [withdrawalStatus]);

  // Clear withdrawal status when user returns to the page (e.g., via back button)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Clear withdrawal status if user returns to the page
        if (withdrawalStatusRef.current === "Redirecting to withdrawal...") {
          setWithdrawalStatus(null);
          setIsWithdrawing(false);
        }
      }
    };

    // Clear on mount if status is still set (in case of page refresh or navigation)
    if (withdrawalStatusRef.current === "Redirecting to withdrawal...") {
      setWithdrawalStatus(null);
      setIsWithdrawing(false);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []); // Empty deps - only run on mount/unmount

  const dropdownOptions = [
    {
      icon: <ArrowsRightLeftIcon className="h-4 w-4 text-gray-900 dark:text-gray-100" />,
      label: "Withdraw",
      onClick: async () => {
        setWithdrawalStatus("Checking configuration...");

        // Check if Coinbase API keys are configured
        try {
          const config = await checkCoinbaseConfig();
          if (!config.isConfigured) {
            setOpenWarningModal(true);
            setWithdrawalStatus(null);
            return;
          }

          // Allow withdrawals in any environment if API keys are configured
          // This enables testing in development/staging environments
        } catch (error) {
          console.error("Failed to check Coinbase configuration:", error);
          setWithdrawalStatus("Failed to check configuration");
          setTimeout(() => setWithdrawalStatus(null), 3000);
          return;
        }

        if (!wallet?.address || !wallet?.chain) {
          console.error("Missing wallet or user information for withdrawal");
          setWithdrawalStatus("Missing wallet information");
          setTimeout(() => setWithdrawalStatus(null), 3000);
          return;
        }

        // Check if wallet is on a testnet - Coinbase Offramp only works with mainnet
        const testnetChains = ["base-sepolia", "sepolia", "goerli", "mumbai"];
        const isTestnet = testnetChains.includes(wallet.chain.toLowerCase());

        if (isTestnet) {
          console.warn("Withdrawal attempted on testnet:", wallet.chain);
          setWithdrawalStatus("Withdrawals only work on mainnet. Please switch to Base mainnet.");
          setTimeout(() => setWithdrawalStatus(null), 5000);
          return;
        }

        setIsWithdrawing(true);
        setWithdrawalStatus("Creating secure session...");

        try {
          // Validate wallet chain format for Coinbase compatibility
          // Coinbase only supports mainnet chains for withdrawals
          const chainMapping: Record<string, string> = {
            base: "base",
            ethereum: "ethereum",
            polygon: "polygon",
            arbitrum: "arbitrum",
            optimism: "optimism",
          };

          const normalizedChain = chainMapping[wallet.chain.toLowerCase()];

          if (!normalizedChain) {
            console.error("Unsupported chain for withdrawal:", wallet.chain);
            setWithdrawalStatus(`Withdrawals not supported on ${wallet.chain}`);
            setTimeout(() => setWithdrawalStatus(null), 5000);
            setIsWithdrawing(false);
            return;
          }

          console.log("=== Withdrawal Debug Info ===", {
            originalChain: wallet.chain,
            normalizedChain,
            address: wallet.address,
            assets: ["USDC"],
          });

          const token = await createCoinbaseSessionToken({
            address: wallet.address,
            blockchains: [normalizedChain],
            assets: ["USDC"],
          });

          if (!token) {
            setWithdrawalStatus("Withdrawals require Coinbase API keys to be configured");
            setTimeout(() => setWithdrawalStatus(null), 3000);
            return;
          }

          setWithdrawalStatus("Redirecting to withdrawal...");

          const params = new URLSearchParams({
            sessionToken: token,
            partnerUserId: wallet.address,
            redirectUrl: window.location.origin,
          });

          const offrampUrl = `https://pay.coinbase.com/v3/sell/input?${params}`;

          // Small delay to show the "redirecting" message
          setTimeout(() => {
            window.location.href = offrampUrl;
          }, 500);
        } catch (error) {
          console.error(
            "Withdrawal failed:",
            error instanceof Error ? error.message : "Unknown error"
          );

          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          setWithdrawalStatus(`Error: ${errorMessage}`);
          setTimeout(() => setWithdrawalStatus(null), 5000);
        } finally {
          setIsWithdrawing(false);
        }
      },
      disabled: false,
    },
    {
      icon: <DocumentTextIcon className="h-4 w-4 text-gray-900 dark:text-gray-100" />,
      label: "Reports",
      onClick: () => {
        setShowReports(true);
      },
    },
    {
      icon: <WalletIcon className="h-4 w-4 text-gray-900 dark:text-gray-100" />,
      label: "Wallet Details",
      onClick: () => {
        setShowWalletDetails(true);
      },
    },
  ];

  const dropdownTrigger = (
    <button className="bg-secondary hover:bg-secondary/80 rounded-full p-2.5">
      <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
    </button>
  );

  return (
    <Container className="flex w-full max-w-5xl flex-col items-center justify-between md:flex-row md:items-stretch">
      <WalletBalance />
      <div className="flex w-full items-center gap-2 md:w-auto md:justify-end">
        <DepositButton onClick={onDepositClick} />
        <button
          type="button"
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 flex h-12 flex-grow items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition md:w-40"
          onClick={onSendClick}
        >
          <ArrowUpRightIcon className="h-4 w-4 text-gray-500" /> Send
        </button>
        <Dropdown trigger={dropdownTrigger} options={dropdownOptions} />
        {(isWithdrawing || withdrawalStatus) && (
          <div className="ml-2 flex items-center space-x-2 text-sm">
            {isWithdrawing && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            )}
            <span
              className={`${withdrawalStatus?.startsWith("Error:") ? "text-red-600" : "text-gray-500"}`}
            >
              {withdrawalStatus || "Preparing withdrawal..."}
            </span>
          </div>
        )}
      </div>
      <WalletDetails onClose={() => setShowWalletDetails(false)} open={showWalletDetails} />
      <EarningsReport open={showReports} onClose={() => setShowReports(false)} />
      <WarningModal open={openWarningModal} onClose={() => setOpenWarningModal(false)} />
    </Container>
  );
}
