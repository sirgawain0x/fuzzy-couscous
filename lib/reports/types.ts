export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "send"
  | "receive"
  | "vault_deposit"
  | "vault_withdrawal"
  | "yield"
  | "supply"
  | "borrow"
  | "repay";

export type TransactionSource = "coinbase" | "crossmint" | "aave" | "yearn";

export interface ReportTransaction {
  date: string;
  type: TransactionType;
  asset: string;
  amount: string;
  fee?: string;
  txHash?: string;
  source: TransactionSource;
  description?: string;
}

export interface EarningsSummary {
  totalDeposited: string;
  totalWithdrawn: string;
  totalYieldEarned: string;
  totalFeesPaid: string;
  netPosition: string;
}

export interface EarningsReport {
  walletAddress: string;
  generatedAt: string;
  period: {
    from: string;
    to: string;
  };
  summary: EarningsSummary;
  transactions: ReportTransaction[];
}

export interface ReportRequest {
  walletAddress: string;
  from?: string; // ISO date
  to?: string; // ISO date
}
