import { Web3Service } from "@unlock-protocol/unlock-js";
import { Address } from "viem";

import { MEMBERSHIP_LOCKS, MembershipTier } from "@/lib/config/memberships";
import { unlockAddress, unlockChainId, unlockProviderUrl } from "@/lib/config/unlock";

type UnlockNetworkConfig = Record<
  number,
  {
    unlockAddress: string;
    provider: string;
  }
>;

export type UnlockMembershipState = {
  hasValidKey: boolean;
  expiresAtMs: number | null;
  error?: string;
};

const networkConfig: UnlockNetworkConfig = {
  [unlockChainId]: {
    unlockAddress,
    provider: unlockProviderUrl,
  },
};

let cachedService: Web3Service | null = null;

const getWeb3Service = () => {
  if (!cachedService) {
    console.log("[unlockMemberships] Initializing Web3Service with config:", {
      chainId: unlockChainId,
      unlockAddress,
      providerUrl: unlockProviderUrl,
      networkConfig,
    });
    cachedService = new Web3Service(networkConfig);
  }

  return cachedService;
};

// Validate network configuration
const validateNetworkConfig = () => {
  const BASE_MAINNET_CHAIN_ID = 8453;
  const isBaseMainnet = unlockChainId === BASE_MAINNET_CHAIN_ID;

  console.log("[unlockMemberships] Network Configuration Check:", {
    unlockChainId,
    expectedChainId: BASE_MAINNET_CHAIN_ID,
    isBaseMainnet,
    membershipLocksNetwork: "Base Mainnet (8453)",
    warning: !isBaseMainnet
      ? "⚠️ WARNING: Unlock chain ID does not match Base Mainnet! Memberships may not be detected."
      : "✓ Network configuration correct",
  });

  return isBaseMainnet;
};

const parseMembershipState = (key: unknown): UnlockMembershipState => {
  console.log("[unlockMemberships] Parsing key:", key);

  if (!key || typeof key !== "object") {
    console.log("[unlockMemberships] Key is null or not an object");
    return { hasValidKey: false, expiresAtMs: null };
  }

  const keyRecord = key as Record<string, unknown>;
  const expirationValue = keyRecord.expiration ?? keyRecord.expirationTimestamp;
  const validValue = keyRecord.valid ?? keyRecord.hasValidKey;

  console.log("[unlockMemberships] expirationValue:", expirationValue, "validValue:", validValue);

  const expirationInSeconds =
    typeof expirationValue === "string"
      ? Number(expirationValue)
      : typeof expirationValue === "number"
        ? expirationValue
        : typeof expirationValue === "bigint"
          ? Number(expirationValue)
          : null;

  const expiresAtMs =
    typeof expirationInSeconds === "number" && Number.isFinite(expirationInSeconds)
      ? expirationInSeconds * 1000
      : null;

  console.log(
    "[unlockMemberships] expiresAtMs:",
    expiresAtMs,
    "now:",
    Date.now(),
    "isValid:",
    expiresAtMs && expiresAtMs > Date.now()
  );

  if (typeof validValue === "boolean") {
    console.log("[unlockMemberships] Using explicit validValue:", validValue);
    return { hasValidKey: validValue, expiresAtMs };
  }

  if (expiresAtMs && expiresAtMs > Date.now()) {
    console.log("[unlockMemberships] Key is valid based on expiration");
    return { hasValidKey: true, expiresAtMs };
  }

  console.log("[unlockMemberships] Key is not valid");
  return { hasValidKey: false, expiresAtMs: null };
};

const createEmptyState = () =>
  MEMBERSHIP_LOCKS.reduce<Record<MembershipTier, UnlockMembershipState>>(
    (accumulator, membershipLock) => {
      accumulator[membershipLock.tier] = {
        hasValidKey: false,
        expiresAtMs: null,
      };
      return accumulator;
    },
    {} as Record<MembershipTier, UnlockMembershipState>
  );

export const fetchUnlockMembershipStates = async (walletAddress: Address) => {
  console.log("[unlockMemberships] ========================================");
  console.log("[unlockMemberships] Starting membership check");
  console.log("[unlockMemberships] Wallet address:", walletAddress);
  console.log("[unlockMemberships] Network config:", networkConfig);
  console.log("[unlockMemberships] ========================================");

  // Validate network configuration
  const isCorrectNetwork = validateNetworkConfig();

  if (!isCorrectNetwork) {
    console.error(
      "[unlockMemberships] ❌ CRITICAL: Network mismatch detected!",
      "\nUnlock Protocol is configured for chain:",
      unlockChainId,
      "\nMembership locks are deployed on Base Mainnet (8453)",
      "\n\nTo fix: Set NEXT_PUBLIC_UNLOCK_CHAIN_ID=8453 or NEXT_PUBLIC_CHAIN_ID=base in your environment variables"
    );
  }

  const service = getWeb3Service();

  const results = await Promise.all(
    MEMBERSHIP_LOCKS.map(async (lock) => {
      console.log(`[unlockMemberships] ----------------------------------------`);
      console.log(`[unlockMemberships] Checking ${lock.tier} membership`);
      console.log(`[unlockMemberships] Lock address: ${lock.address}`);
      console.log(`[unlockMemberships] Chain ID: ${unlockChainId}`);

      try {
        const key = await service.getKeyByLockForOwner(lock.address, walletAddress, unlockChainId);

        console.log(`[unlockMemberships] ✓ Key data received for ${lock.tier}:`, {
          keyExists: !!key,
          keyData: key,
        });

        const state = parseMembershipState(key);

        console.log(`[unlockMemberships] ${state.hasValidKey ? "✓" : "✗"} ${lock.tier} status:`, {
          hasValidKey: state.hasValidKey,
          expiresAtMs: state.expiresAtMs,
          expiresAt: state.expiresAtMs ? new Date(state.expiresAtMs).toISOString() : "N/A",
          isExpired: state.expiresAtMs ? state.expiresAtMs < Date.now() : "N/A",
        });

        return { lock, state };
      } catch (error) {
        console.error(`[unlockMemberships] ✗ Failed to fetch ${lock.tier} membership:`, {
          lockAddress: lock.address,
          walletAddress,
          chainId: unlockChainId,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });

        return {
          lock,
          state: {
            hasValidKey: false,
            expiresAtMs: null,
            error: error instanceof Error ? error.message : "Failed to fetch membership",
          } satisfies UnlockMembershipState,
        };
      }
    })
  );

  const finalState = results.reduce<Record<MembershipTier, UnlockMembershipState>>(
    (accumulator, result) => {
      accumulator[result.lock.tier] = result.state;
      return accumulator;
    },
    createEmptyState()
  );

  console.log("[unlockMemberships] ========================================");
  console.log("[unlockMemberships] FINAL MEMBERSHIP SUMMARY:");
  Object.entries(finalState).forEach(([tier, state]) => {
    console.log(`  ${state.hasValidKey ? "✓" : "✗"} ${tier}:`, {
      hasValidKey: state.hasValidKey,
      expiresAt: state.expiresAtMs ? new Date(state.expiresAtMs).toISOString() : "None",
      error: state.error || "None",
    });
  });
  console.log("[unlockMemberships] ========================================");

  return finalState;
};
