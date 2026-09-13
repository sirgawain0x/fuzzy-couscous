"use client";

import { useEffect, useState } from "react";
import { Login } from "@/components/Login";
import { MainScreen } from "@/components/MainScreen";
import { useAuth } from "@/context/AuthContext";
import { useAppWallet } from "@/hooks/useAppWallet";
import { useProcessWithdrawal } from "@/hooks/useProcessWithdrawal";
import { useMembership } from "@/context/MembershipContext";
import { upsertUser } from "@/server-actions/getTransactions";
import { MembershipOnboarding } from "@/components/unlock/MembershipOnboarding";

const ONBOARDING_DISMISSED_KEY = "has_seen_membership_onboarding";

export function HomeContent() {
  const { wallet, status: walletStatus, address: walletAddress } = useAppWallet();
  const { status: authStatus, user } = useAuth();
  const { tier, isLoading: membershipLoading, refresh: refreshMembership } = useMembership();

  const [hasDismissedOnboarding, setHasDismissedOnboarding] = useState(true);

  useProcessWithdrawal(walletAddress, wallet);

  const isLoggedIn = wallet != null && authStatus === "logged-in";
  const isLoading =
    authStatus === "initializing" ||
    (authStatus === "logged-in" && walletStatus !== "loaded" && walletStatus !== "error");

  const hasMembership = !membershipLoading && tier !== null;

  useEffect(() => {
    const dismissed = localStorage.getItem(ONBOARDING_DISMISSED_KEY);
    setHasDismissedOnboarding(dismissed === "true");
  }, []);

  useEffect(() => {
    if (isLoggedIn && user?.id && walletAddress) {
      upsertUser(user.id, walletAddress, user.email, user.phoneNumber);
    }
  }, [isLoggedIn, user?.id, walletAddress, user?.email, user?.phoneNumber]);

  const handleSkipOnboarding = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
    setHasDismissedOnboarding(true);
  };

  const handlePurchaseComplete = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
    setHasDismissedOnboarding(true);
    refreshMembership();
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login />;
  }

  if (!membershipLoading && !hasMembership && !hasDismissedOnboarding) {
    return (
      <MembershipOnboarding
        onSkip={handleSkipOnboarding}
        onPurchaseComplete={handlePurchaseComplete}
      />
    );
  }

  return <MainScreen walletAddress={walletAddress} />;
}
