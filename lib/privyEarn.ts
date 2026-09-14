import { APIError, PrivyClient, isEmbeddedWalletLinkedAccount } from "@privy-io/node";
import { PRIVY_EARN_VAULT_ID } from "@/lib/config/privyEarn";
import {
  isPrivyEarnActionStatus,
  type PrivyEarnActionPublic,
  type PrivyEarnActionStatus,
  type PrivyEarnPositionPublic,
  type PrivyEarnVaultPublic,
} from "@/lib/privyEarnTypes";

let privyNodeClient: PrivyClient | null = null;

/** Primary env names from .env.template, plus legacy aliases used in some local setups. */
const resolvePrivyAppCredentials = (): { appId: string; appSecret: string } => {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET || process.env.PRIVY_SECRET;

  if (!appId || !appSecret) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
  }

  return { appId, appSecret };
};

export const getPrivyNodeClient = (): PrivyClient => {
  if (privyNodeClient) return privyNodeClient;

  const { appId, appSecret } = resolvePrivyAppCredentials();
  privyNodeClient = new PrivyClient({ appId, appSecret });
  return privyNodeClient;
};

export type EarnHttpError = {
  status: number;
  message: string;
};

export const toEarnHttpError = (error: unknown, fallback: string): EarnHttpError => {
  if (error instanceof APIError) {
    const status = typeof error.status === "number" ? error.status : 500;
    if (status === 401) {
      return {
        status,
        message: "Privy Earn is misconfigured (invalid app credentials).",
      };
    }
    return { status, message: error.message || fallback };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message || fallback };
  }
  return { status: 500, message: fallback };
};

const mapVaultDetails = (details: {
  id: string;
  name: string;
  provider: string;
  vault_address: string;
  asset: { address: string; symbol: string; decimals: number };
  caip2: string;
  user_apy: number | null;
  tvl_usd: number | null;
  available_liquidity_usd: number | null;
}): PrivyEarnVaultPublic => {
  const userApyBps = details.user_apy;
  return {
    id: details.id,
    name: details.name,
    provider: details.provider,
    vaultAddress: details.vault_address,
    asset: {
      address: details.asset.address,
      symbol: details.asset.symbol,
      decimals: details.asset.decimals,
    },
    caip2: details.caip2,
    userApyBps,
    userApyPercent: userApyBps == null ? null : userApyBps / 100,
    tvlUsd: details.tvl_usd,
    availableLiquidityUsd: details.available_liquidity_usd,
  };
};

export const getEarnVaultDetails = async (
  vaultId: string = PRIVY_EARN_VAULT_ID
): Promise<PrivyEarnVaultPublic> => {
  const client = getPrivyNodeClient();
  const details = await client.wallets().earn().ethereum().vaultDetails(vaultId);
  return mapVaultDetails(details);
};

export const resolveEmbeddedWalletId = async (
  userId: string,
  walletAddress: string
): Promise<string> => {
  const client = getPrivyNodeClient();
  const user = await client.users()._get(userId);
  const target = walletAddress.toLowerCase();

  for (const account of user.linked_accounts) {
    if (!isEmbeddedWalletLinkedAccount(account)) continue;
    if (account.chain_type !== "ethereum") continue;
    if (account.address.toLowerCase() !== target) continue;
    if (!account.id) {
      throw new Error("No Privy embedded wallet found for this account");
    }
    return account.id;
  }

  throw new Error("No Privy embedded wallet found for this account");
};

const subtractRaw = (left: string, right: string): bigint => {
  return BigInt(left) - BigInt(right);
};

export const getEarnPosition = async (
  walletId: string,
  vaultId: string = PRIVY_EARN_VAULT_ID
): Promise<PrivyEarnPositionPublic> => {
  const client = getPrivyNodeClient();
  const position = await client.wallets().earn().ethereum().vaultPosition(walletId, {
    vault_id: vaultId,
  });

  const netContributed = subtractRaw(position.total_deposited, position.total_withdrawn);
  const earnedYield = subtractRaw(position.assets_in_vault, netContributed.toString());

  return {
    asset: {
      address: position.asset.address,
      symbol: position.asset.symbol,
      decimals: position.asset.decimals,
    },
    assetsInVault: position.assets_in_vault,
    sharesInVault: position.shares_in_vault,
    totalDeposited: position.total_deposited,
    totalWithdrawn: position.total_withdrawn,
    earnedYield: earnedYield.toString(),
  };
};

export const depositEarn = async (input: {
  walletId: string;
  accessToken: string;
  amount: string;
  vaultId?: string;
}): Promise<PrivyEarnActionPublic> => {
  const client = getPrivyNodeClient();
  const action = await client
    .wallets()
    .earn()
    .ethereum()
    .deposit(input.walletId, {
      vault_id: input.vaultId ?? PRIVY_EARN_VAULT_ID,
      amount: input.amount,
      authorization_context: { user_jwts: [input.accessToken] },
    });
  return mapEarnAction(toEarnActionLike(action));
};

export const withdrawEarn = async (input: {
  walletId: string;
  accessToken: string;
  amount?: string;
  rawAmount?: string;
  vaultId?: string;
}): Promise<PrivyEarnActionPublic> => {
  const client = getPrivyNodeClient();
  const action = await client
    .wallets()
    .earn()
    .ethereum()
    .withdraw(input.walletId, {
      vault_id: input.vaultId ?? PRIVY_EARN_VAULT_ID,
      ...(input.rawAmount ? { raw_amount: input.rawAmount } : { amount: input.amount }),
      authorization_context: { user_jwts: [input.accessToken] },
    });
  return mapEarnAction(toEarnActionLike(action));
};

export const getEarnAction = async (
  walletId: string,
  actionId: string
): Promise<PrivyEarnActionPublic> => {
  const client = getPrivyNodeClient();
  const action = await client.wallets().actions.get(actionId, {
    wallet_id: walletId,
    include: "steps",
  });
  return mapEarnAction(toEarnActionLike(action));
};

const mapActionStatus = (status: string): PrivyEarnActionStatus => {
  if (isPrivyEarnActionStatus(status)) return status;
  return "failed";
};

type EarnActionStepLike = {
  type: string;
  transaction_hash?: string | null;
  bundle_transaction_hash?: string | null;
};

type EarnActionLike = {
  id: string;
  type: string;
  status: string;
  amount?: string;
  share_amount?: string | null;
  vault_address?: string;
  failure_reason?: { message?: string } | null;
  steps?: EarnActionStepLike[];
};

const extractTxHash = (steps: EarnActionStepLike[] | undefined): string | null => {
  if (!steps) return null;
  for (const step of steps) {
    if (step.type === "evm_transaction" && step.transaction_hash) {
      return step.transaction_hash;
    }
    if (step.type === "evm_user_operation" && step.bundle_transaction_hash) {
      return step.bundle_transaction_hash;
    }
  }
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const toEarnActionLike = (action: unknown): EarnActionLike => {
  if (!isRecord(action)) {
    return {
      id: "",
      type: "unknown",
      status: "failed",
      share_amount: null,
      vault_address: "",
    };
  }

  const failure = isRecord(action.failure_reason) ? action.failure_reason : null;
  const steps = Array.isArray(action.steps)
    ? action.steps.filter(isRecord).map((step) => ({
        type: readString(step.type) ?? "",
        transaction_hash: readString(step.transaction_hash) ?? null,
        bundle_transaction_hash: readString(step.bundle_transaction_hash) ?? null,
      }))
    : undefined;

  return {
    id: readString(action.id) ?? "",
    type: readString(action.type) ?? "unknown",
    status: readString(action.status) ?? "failed",
    amount: readString(action.amount),
    share_amount: readString(action.share_amount) ?? null,
    vault_address: readString(action.vault_address) ?? "",
    failure_reason: failure ? { message: readString(failure.message) } : null,
    steps,
  };
};

const mapEarnAction = (action: EarnActionLike): PrivyEarnActionPublic => ({
  id: action.id,
  type: action.type,
  status: mapActionStatus(action.status),
  amount: action.amount,
  shareAmount: action.share_amount ?? null,
  vaultAddress: action.vault_address ?? "",
  failureReason: action.failure_reason?.message,
  txHash: extractTxHash(action.steps),
});

export const isPositiveDecimalAmount = (value: string): boolean => {
  if (!/^\d+(\.\d{1,8})?$/.test(value)) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
};
