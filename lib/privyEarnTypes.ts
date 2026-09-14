export type PrivyEarnVaultPublic = {
  id: string;
  name: string;
  provider: string;
  vaultAddress: string;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  caip2: string;
  userApyBps: number | null;
  userApyPercent: number | null;
  tvlUsd: number | null;
  availableLiquidityUsd: number | null;
};

export type PrivyEarnPositionPublic = {
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  assetsInVault: string;
  sharesInVault: string;
  totalDeposited: string;
  totalWithdrawn: string;
  earnedYield: string;
};

export type PrivyEarnActionStatus = "pending" | "succeeded" | "rejected" | "failed";

export type PrivyEarnActionPublic = {
  id: string;
  type: string;
  status: PrivyEarnActionStatus;
  amount?: string;
  shareAmount: string | null;
  vaultAddress: string;
  failureReason?: string;
  txHash?: string | null;
};

export const isPrivyEarnActionStatus = (value: string): value is PrivyEarnActionStatus =>
  value === "pending" || value === "succeeded" || value === "rejected" || value === "failed";
