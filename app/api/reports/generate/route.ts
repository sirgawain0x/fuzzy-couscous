import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/cockroachdb";
import type { EarningsReport, EarningsSummary, ReportTransaction } from "@/lib/reports/types";
import { requireAuthedWallet, assertWalletMatches } from "@/lib/apiAuth";

const GOLDSKY_ENDPOINT =
  "https://api.goldsky.com/api/public/project_cmh0iv6s500dbw2p22vsxcfo6/subgraphs/usdc-finance-yearn-v3/1.0.0/gn";

/**
 * POST /api/reports/generate
 * Aggregates financial data from CockroachDB (Coinbase transactions),
 * Goldsky subgraph (Yearn vault cashflows), and returns a structured report
 * for the authenticated user's wallet.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, from, to, sessionToken } = body ?? {};

    const auth = await requireAuthedWallet(request, sessionToken);
    if (!auth.ok) return auth.response;

    const mismatch = assertWalletMatches(auth.session.walletAddress, walletAddress);
    if (mismatch) return mismatch;

    const normalizedAddress = auth.session.walletAddress;
    const fromDate = from || "2024-01-01T00:00:00Z";
    const toDate = to || new Date().toISOString();

    // Aggregate data from all sources in parallel
    const [coinbaseTransactions, yearnCashflows] = await Promise.all([
      fetchCoinbaseTransactions(normalizedAddress, fromDate, toDate),
      fetchYearnCashflows(normalizedAddress),
    ]);

    // Merge and sort all transactions by date
    const allTransactions = [...coinbaseTransactions, ...yearnCashflows].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate summary
    const summary = calculateSummary(allTransactions);

    const report: EarningsReport = {
      walletAddress: normalizedAddress,
      generatedAt: new Date().toISOString(),
      period: { from: fromDate, to: toDate },
      summary,
      transactions: allTransactions,
    };

    return NextResponse.json(report);
  } catch (err: any) {
    console.error("[Reports] Generation failed:", err.message);
    return NextResponse.json(
      { error: err.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}

/**
 * Fetch Coinbase onramp/offramp transactions from CockroachDB.
 */
async function fetchCoinbaseTransactions(
  walletAddress: string,
  from: string,
  to: string
): Promise<ReportTransaction[]> {
  if (!process.env.COCKROACHDB_URL) return [];

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT transaction_id, type, status, sell_amount_value, sell_amount_currency,
              buy_amount_value, buy_amount_currency, onchain_hash, created_at, raw_data
       FROM transactions
       WHERE wallet_address = $1 AND created_at >= $2 AND created_at <= $3
       ORDER BY created_at ASC`,
      [walletAddress, from, to]
    );

    return rows.map((row: any) => {
      const isOnramp = row.type === "onramp" || row.buy_amount_currency === "USDC";

      // Extract fees from raw_data if available
      let fee: string | undefined;
      if (row.raw_data?.fees) {
        const totalFees = row.raw_data.fees.reduce(
          (sum: number, f: any) => sum + Number(f.amount || 0),
          0
        );
        if (totalFees > 0) fee = totalFees.toFixed(2);
      }

      return {
        date: new Date(row.created_at).toISOString(),
        type: isOnramp ? "deposit" : "withdrawal",
        asset: isOnramp ? row.buy_amount_currency || "USDC" : row.sell_amount_currency || "USDC",
        amount: isOnramp ? row.buy_amount_value || "0" : row.sell_amount_value || "0",
        fee,
        txHash: row.onchain_hash || undefined,
        source: "coinbase" as const,
        description: isOnramp
          ? `Bought ${row.buy_amount_value} ${row.buy_amount_currency || "USDC"}`
          : `Sold ${row.sell_amount_value} ${row.sell_amount_currency || "USDC"}`,
      };
    });
  } catch (error) {
    console.error("[Reports] CockroachDB query failed:", error);
    return [];
  }
}

/**
 * Fetch Yearn V3 vault deposit/withdrawal events from Goldsky subgraph.
 */
async function fetchYearnCashflows(walletAddress: string): Promise<ReportTransaction[]> {
  try {
    const query = `{
      deposits(
        where: { sender: "${walletAddress}" }
        orderBy: blockTimestamp
        orderDirection: asc
        first: 1000
      ) {
        id
        sender
        owner
        assets
        shares
        blockTimestamp
        transactionHash
      }
      withdraws(
        where: { owner: "${walletAddress}" }
        orderBy: blockTimestamp
        orderDirection: asc
        first: 1000
      ) {
        id
        sender
        owner
        assets
        shares
        receiver
        blockTimestamp
        transactionHash
      }
    }`;

    const response = await fetch(GOLDSKY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error("[Reports] Goldsky query failed:", response.status);
      return [];
    }

    const { data } = await response.json();
    const transactions: ReportTransaction[] = [];

    // Process deposits
    for (const d of data?.deposits || []) {
      const amount = (Number(d.assets) / 1e6).toFixed(2); // USDC = 6 decimals
      transactions.push({
        date: new Date(Number(d.blockTimestamp) * 1000).toISOString(),
        type: "vault_deposit",
        asset: "USDC",
        amount,
        txHash: d.transactionHash,
        source: "yearn",
        description: `Deposited ${amount} USDC into Yearn vault`,
      });
    }

    // Process withdrawals
    for (const w of data?.withdraws || []) {
      const amount = (Number(w.assets) / 1e6).toFixed(2);
      transactions.push({
        date: new Date(Number(w.blockTimestamp) * 1000).toISOString(),
        type: "vault_withdrawal",
        asset: "USDC",
        amount,
        txHash: w.transactionHash,
        source: "yearn",
        description: `Withdrew ${amount} USDC from Yearn vault`,
      });
    }

    return transactions;
  } catch (error) {
    console.error("[Reports] Goldsky fetch failed:", error);
    return [];
  }
}

/**
 * Calculate summary metrics from all transactions.
 */
function calculateSummary(transactions: ReportTransaction[]): EarningsSummary {
  let totalDeposited = 0;
  let totalWithdrawn = 0;
  let totalFeesPaid = 0;
  let vaultDeposits = 0;
  let vaultWithdrawals = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    const fee = Number(tx.fee) || 0;

    switch (tx.type) {
      case "deposit":
        totalDeposited += amount;
        break;
      case "withdrawal":
        totalWithdrawn += amount;
        break;
      case "vault_deposit":
        vaultDeposits += amount;
        break;
      case "vault_withdrawal":
        vaultWithdrawals += amount;
        break;
      case "yield":
        // Yield is pure profit
        break;
    }

    totalFeesPaid += fee;
  }

  // Net yield = vault withdrawals - vault deposits (positive = profit)
  const totalYieldEarned = Math.max(0, vaultWithdrawals - vaultDeposits);

  // Net position = total in - total out + yield
  const netPosition = totalDeposited - totalWithdrawn + totalYieldEarned;

  return {
    totalDeposited: totalDeposited.toFixed(2),
    totalWithdrawn: totalWithdrawn.toFixed(2),
    totalYieldEarned: totalYieldEarned.toFixed(2),
    totalFeesPaid: totalFeesPaid.toFixed(2),
    netPosition: netPosition.toFixed(2),
  };
}
