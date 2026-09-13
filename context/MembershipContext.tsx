"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Address } from "viem";
import { useAccount } from "wagmi";
import { useAuth } from "@/context/AuthContext";
import { useAppWallet } from "@/hooks/useAppWallet";

import { MEMBERSHIP_LOCKS, MembershipTier } from "@/lib/config/memberships";
import { fetchUnlockMembershipStates } from "@/lib/services/unlockMemberships";

type MembershipLockState = {
  hasValidKey: boolean;
  expiresAtMs: number | null;
  error?: string;
};

type MembershipContextValue = {
  tier: MembershipTier | null;
  isLoading: boolean;
  locks: Record<MembershipTier, MembershipLockState>;
  refresh: () => Promise<void>;
};

const defaultState: MembershipContextValue = {
  tier: null,
  isLoading: true,
  locks: {
    "Creative Brand": { hasValidKey: false, expiresAtMs: null },
    "Creative Investor": { hasValidKey: false, expiresAtMs: null },
    "Creative Creator": { hasValidKey: false, expiresAtMs: null },
  },
  refresh: async () => undefined,
};

const MembershipContext = createContext<MembershipContextValue>(defaultState);

const createInitialLockState = () =>
  MEMBERSHIP_LOCKS.reduce<Record<MembershipTier, MembershipLockState>>(
    (accumulator, lock) => {
      accumulator[lock.tier] = { hasValidKey: false, expiresAtMs: null };
      return accumulator;
    },
    {
      "Creative Brand": { hasValidKey: false, expiresAtMs: null },
      "Creative Investor": { hasValidKey: false, expiresAtMs: null },
      "Creative Creator": { hasValidKey: false, expiresAtMs: null },
    }
  );

const initialLockState = createInitialLockState();

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const { address: appWalletAddress, status: walletStatus } = useAppWallet();
  const { status: authStatus } = useAuth();
  const [state, setState] = useState<Omit<MembershipContextValue, "refresh">>({
    tier: null,
    isLoading: true,
    locks: createInitialLockState(),
  });
  const currentAddressRef = useRef<Address | null>(null);

  const activeAddress = useMemo(() => {
    console.log("[MembershipContext] ========================================");
    console.log("[MembershipContext] Computing active address");
    console.log("[MembershipContext] Wagmi address:", address);
    console.log("[MembershipContext] App wallet address:", appWalletAddress);
    console.log("[MembershipContext] Auth status:", authStatus);
    console.log("[MembershipContext] Wallet status:", walletStatus);

    if (appWalletAddress) {
      console.log("[MembershipContext] ✓ Using embedded wallet address:", appWalletAddress);
      console.log("[MembershipContext] ========================================");
      return appWalletAddress as Address;
    }

    // Fallback to wagmi address (for browser wallet connections)
    if (address) {
      console.log("[MembershipContext] ✓ Using wagmi address:", address);
      console.log("[MembershipContext] ========================================");
      return address;
    }

    if (authStatus === "initializing" || walletStatus === "not-loaded") {
      console.log("[MembershipContext] ⏳ Wallet still loading, waiting...");
    } else {
      console.log("[MembershipContext] ✗ No active address detected");
    }
    console.log("[MembershipContext] ========================================");

    return null;
  }, [address, authStatus, appWalletAddress, walletStatus]);

  const applyResults = useCallback((locks: Record<MembershipTier, MembershipLockState>) => {
    console.log("[MembershipContext] ========================================");
    console.log("[MembershipContext] Applying membership results");
    console.log("[MembershipContext] Raw locks data:", locks);

    const validLocks = MEMBERSHIP_LOCKS.filter((lock) => {
      const isValid = locks[lock.tier]?.hasValidKey;
      console.log(`[MembershipContext] ${lock.tier}:`, {
        hasValidKey: isValid,
        priority: lock.priority,
        expiresAtMs: locks[lock.tier]?.expiresAtMs,
        expiresAt: locks[lock.tier]?.expiresAtMs
          ? new Date(locks[lock.tier].expiresAtMs!).toISOString()
          : "N/A",
      });
      return isValid;
    });

    const sorted = validLocks.sort((a, b) => b.priority - a.priority);
    const tier = sorted.length > 0 ? sorted[0].tier : null;

    console.log(
      "[MembershipContext] Valid locks found:",
      validLocks.map((l) => l.tier)
    );
    console.log("[MembershipContext] Selected highest priority tier:", tier);
    console.log("[MembershipContext] ========================================");

    setState({
      tier,
      isLoading: false,
      locks,
    });
  }, []);

  const resetState = useCallback(() => {
    setState({
      tier: null,
      isLoading: false,
      locks: createInitialLockState(),
    });
  }, []);

  const refresh = useCallback(async () => {
    console.log("[MembershipContext] Refresh called, activeAddress:", activeAddress);

    if (!activeAddress) {
      console.log("[MembershipContext] No active address, resetting state");
      resetState();
      return;
    }

    setState((previous) => ({
      ...previous,
      isLoading: true,
    }));

    const walletAddress = activeAddress;
    currentAddressRef.current = walletAddress;

    console.log("[MembershipContext] Starting membership fetch for:", walletAddress);

    try {
      const locksState = await fetchUnlockMembershipStates(walletAddress);

      console.log("[MembershipContext] Received locks state:", locksState);

      if (currentAddressRef.current !== walletAddress) {
        console.log("[MembershipContext] Address changed during fetch, ignoring results");
        return;
      }

      applyResults(locksState);
    } catch (error) {
      console.error("[MembershipContext] Unlock membership refresh failed", error);

      if (currentAddressRef.current !== walletAddress) {
        return;
      }

      applyResults(createInitialLockState());
    }
  }, [activeAddress, applyResults, resetState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      tier: state.tier,
      isLoading: state.isLoading,
      locks: state.locks,
      refresh,
    }),
    [state, refresh]
  );

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMembership() {
  return useContext(MembershipContext);
}
