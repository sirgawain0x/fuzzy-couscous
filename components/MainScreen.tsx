import Image from "next/image";
import { useState } from "react";
import { DepositModal } from "@/components/deposit";
import { SendFundsModal } from "@/components/send-funds";
import { ActivityFeed } from "@/components/ActivityFeed";
import { useAuth } from "@/context/AuthContext";
import { NewProducts } from "./NewProducts";
import { DashboardSummary } from "./dashboard-summary";
import { WithdrawalStatus } from "./dashboard-summary/WithdrawalStatus";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { useMembership } from "@/context/MembershipContext";
import { MembershipBanner } from "@/components/unlock/MembershipBanner";
import { HealthAlertToast } from "@/components/alerts/HealthAlertToast";

interface MainScreenProps {
  walletAddress?: string;
}

export function MainScreen({ walletAddress }: MainScreenProps) {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const { logout } = useAuth();
  const { tier } = useMembership();

  return (
    <div className="flex h-full w-full items-center justify-center gap-2 px-3 py-8">
      <div className="h-full w-full max-w-5xl">
        {/* Mobile: Theme Toggle above everything */}
        <div className="mb-2 flex w-full justify-center md:hidden">
          <ThemeToggle />
        </div>

        {/* Mobile: Logo row */}
        <div className="relative mb-3 flex h-14 w-full max-w-5xl items-center justify-center px-2 md:hidden">
          <div className="flex items-center gap-2">
            <Image
              src="/creative_finance_logo.svg"
              alt="Creative Finance logo"
              width={54}
              height={54}
              style={{ height: "auto" }}
            />
            <h1 className="text-lg" style={{ fontFamily: "var(--font-conthrax), sans-serif" }}>
              CREATIVE
              <span
                className="text-md ml-1 font-bold text-red-500"
                style={{ fontFamily: "sans-serif" }}
              >
                FINANCE
              </span>
            </h1>
          </div>
        </div>

        {/* Mobile: Membership badge and Logout button */}
        <div className="relative mb-3 flex w-full max-w-5xl items-center justify-center gap-2 px-2 md:hidden">
          {tier && (
            <div className="rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-100">
              {tier}
            </div>
          )}
          <button onClick={logout} className="text-secondary flex items-center gap-1 text-base">
            Logout
            <ArrowRightOnRectangleIcon className="text h-6 w-6" />
          </button>
        </div>

        {/* Desktop: Everything on one line */}
        <div className="relative mb-3 hidden h-14 w-full max-w-5xl items-center justify-between px-2 md:flex">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="/creative_finance_logo.svg"
              alt="Creative Finance logo"
              width={54}
              height={54}
              style={{ height: "auto" }}
            />
            <h1 className="text-lg" style={{ fontFamily: "var(--font-conthrax), sans-serif" }}>
              CREATIVE
              <span
                className="text-md ml-1 font-bold text-red-500"
                style={{ fontFamily: "sans-serif" }}
              >
                FINANCE
              </span>
            </h1>
          </div>

          {/* Right: Membership badge, Theme Toggle, and Logout button */}
          <div className="flex items-center gap-2">
            {tier && (
              <div className="rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-100">
                {tier}
              </div>
            )}
            <ThemeToggle />
            <button onClick={logout} className="text-secondary flex items-center gap-1 text-base">
              Logout
              <ArrowRightOnRectangleIcon className="text h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Dashboard title */}
        <div className="relative mb-2 flex w-full max-w-5xl items-center justify-center">
          <div className="w-full text-center text-xl font-medium">Dashboard</div>
        </div>
        <MembershipBanner />
        <DashboardSummary
          onDepositClick={() => setShowDepositModal(true)}
          onSendClick={() => setShowSendModal(true)}
        />
        <WithdrawalStatus />
        <NewProducts />
        <ActivityFeed onDepositClick={() => setShowDepositModal(true)} />
        <DepositModal
          open={showDepositModal}
          onClose={() => setShowDepositModal(false)}
          walletAddress={walletAddress || ""}
        />
        <SendFundsModal open={showSendModal} onClose={() => setShowSendModal(false)} />
        <HealthAlertToast onTopUpCollateral={() => setShowDepositModal(true)} />
      </div>
    </div>
  );
}
