import type { Pool } from "pg";
import type { UserAccountData } from "./aavePool";

export type HealthCheckResult = {
  snapshotsCreated: number;
  alertsCreated: number;
};

export type AlertSource = "cron" | "price-update";

/**
 * Max rows per multi-row statement. Postgres/CockroachDB cap parameters per
 * query at ~65,535; our tightest statement is the alerts INSERT at 7 params
 * per row, so 1,000 rows × 7 = 7,000 params keeps every statement well under
 * the limit with plenty of headroom.
 */
const CHUNK_SIZE = 1000;

/**
 * Persist snapshots, cached HF, and threshold-transition alerts for a batch
 * of wallets. Replaces the previous 3N-queries-per-wallet loop that would
 * not scale past a few hundred users with borrows. Statements are chunked
 * so the helper stays correct as the user base grows.
 *
 * Only users with active borrows are processed.
 */
export async function processHealthCheck(
  pool: Pool,
  accountData: UserAccountData[],
  source: AlertSource = "cron"
): Promise<HealthCheckResult> {
  const withBorrows = accountData.filter((d) => d.hasBorrows && d.status != null);
  if (withBorrows.length === 0) {
    return { snapshotsCreated: 0, alertsCreated: 0 };
  }

  const wallets = withBorrows.map((d) => d.walletAddress.toLowerCase());

  // 1) Fetch each wallet's most recent prior snapshot status in one query.
  //    Runs BEFORE the inserts below so we see the pre-update state.
  //    ANY($1::text[]) takes a single array param regardless of wallet count.
  const { rows: prevRows } = await pool.query<{ wallet_address: string; status: string }>(
    `SELECT DISTINCT ON (wallet_address) wallet_address, status
     FROM health_factor_snapshots
     WHERE wallet_address = ANY($1::text[])
     ORDER BY wallet_address, created_at DESC`,
    [wallets]
  );
  const prevStatusByWallet = new Map(prevRows.map((r) => [r.wallet_address, r.status]));

  // 2) Multi-row INSERT of fresh snapshots (chunked).
  for (const chunk of chunked(withBorrows, CHUNK_SIZE)) {
    const values: unknown[] = [];
    const placeholders: string[] = [];
    chunk.forEach((d, i) => {
      const b = i * 5;
      placeholders.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`);
      values.push(
        d.walletAddress.toLowerCase(),
        d.healthFactor,
        d.status,
        d.totalCollateralBase.toString(),
        d.totalDebtBase.toString()
      );
    });
    await pool.query(
      `INSERT INTO health_factor_snapshots
       (wallet_address, health_factor, status, total_collateral_base, total_debt_base)
       VALUES ${placeholders.join(",")}`,
      values
    );
  }

  // 3) UPDATE ... FROM (VALUES ...) to refresh cached HF on every user (chunked).
  for (const chunk of chunked(withBorrows, CHUNK_SIZE)) {
    const values: unknown[] = [];
    const placeholders: string[] = [];
    chunk.forEach((d, i) => {
      const b = i * 2;
      placeholders.push(`($${b + 1}::text, $${b + 2}::numeric)`);
      values.push(d.walletAddress.toLowerCase(), d.healthFactor);
    });
    await pool.query(
      `UPDATE users SET last_health_factor = v.hf, updated_at = now()
       FROM (VALUES ${placeholders.join(",")}) AS v(wallet, hf)
       WHERE users.wallet_address = v.wallet`,
      values
    );
  }

  // 4) Build threshold-transition alerts and insert (chunked).
  const alertRows = withBorrows.flatMap((d) => {
    const wallet = d.walletAddress.toLowerCase();
    const prev = prevStatusByWallet.get(wallet) ?? "safe";
    const current = d.status as "safe" | "warning" | "danger";
    const worsened =
      (prev === "safe" && (current === "warning" || current === "danger")) ||
      (prev === "warning" && current === "danger");
    if (!worsened) return [];

    return [
      {
        wallet,
        current,
        prev,
        hf: d.healthFactor,
        message: buildAlertMessage(source, current, d.healthFactor),
        queueEmail: current === "danger",
      },
    ];
  });

  for (const chunk of chunked(alertRows, CHUNK_SIZE)) {
    const values: unknown[] = [];
    const placeholders: string[] = [];
    chunk.forEach((a, i) => {
      const b = i * 7;
      placeholders.push(
        `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`
      );
      values.push(a.wallet, a.current, a.prev, a.current, a.hf, a.message, a.queueEmail);
    });
    await pool.query(
      `INSERT INTO health_alerts
       (wallet_address, alert_type, previous_status, current_status, health_factor, message, email_queued)
       VALUES ${placeholders.join(",")}`,
      values
    );
  }

  return { snapshotsCreated: withBorrows.length, alertsCreated: alertRows.length };
}

function chunked<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function buildAlertMessage(
  source: AlertSource,
  status: "safe" | "warning" | "danger",
  hf: number
): string {
  const hfStr = hf.toFixed(2);
  if (source === "price-update") {
    return status === "danger"
      ? `Your health factor dropped to ${hfStr}. You are at risk of liquidation. Top up collateral immediately.`
      : `Your health factor dropped to ${hfStr}. Consider repaying debt to reduce liquidation risk.`;
  }
  return status === "danger"
    ? `Health factor at ${hfStr}. Liquidation risk is imminent. Top up collateral now.`
    : `Health factor at ${hfStr}. Consider repaying debt to improve your position.`;
}
