/**
 * Health factor status for Aave-style risk meter.
 * Thresholds: Danger < 1, Warning 1 to < 1.2, Safe >= 1.2 (or no borrows).
 */

export type HealthFactorStatus = "safe" | "warning" | "danger" | null;

export type HealthFactorStatusLabel = {
  status: HealthFactorStatus;
  label: string;
  ariaLabel: string;
};

const DANGER_THRESHOLD = 1;
const WARNING_THRESHOLD = 1.2;

/** Minimum health factor required to allow disabling an asset as collateral (when user has borrows). */
export const DISABLE_COLLATERAL_MIN_HEALTH_FACTOR = 1.05;

/**
 * Returns true if the user can safely disable collateral: either they have no borrows,
 * or their current health factor is at least DISABLE_COLLATERAL_MIN_HEALTH_FACTOR.
 */
export function canSafelyDisableCollateral(
  healthFactor: number | string | null | undefined,
  hasBorrows: boolean
): boolean {
  if (!hasBorrows) return true;
  if (healthFactor == null || healthFactor === "") return false;
  const value =
    typeof healthFactor === "string" ? Number.parseFloat(healthFactor) : Number(healthFactor);
  if (Number.isNaN(value)) return false;
  return value >= DISABLE_COLLATERAL_MIN_HEALTH_FACTOR;
}

/**
 * Maps health factor and optional borrow state to a status for the Risk Meter.
 * Returns null when there is no supply/borrow or no health factor (e.g. no borrows).
 */
export function getHealthFactorStatus(
  healthFactor: number | string | null | undefined,
  hasBorrows?: boolean
): HealthFactorStatus {
  if (healthFactor == null || healthFactor === "" || healthFactor === Infinity) {
    return hasBorrows ? "safe" : null; // No borrows: no meter needed (caller may show "Safe" for supply-only).
  }
  const value =
    typeof healthFactor === "string" ? Number.parseFloat(healthFactor) : Number(healthFactor);
  if (Number.isNaN(value)) return null;
  if (value < DANGER_THRESHOLD) return "danger";
  if (value < WARNING_THRESHOLD) return "warning";
  return "safe";
}

/**
 * Returns status plus short label and aria-label for the Risk Meter UI.
 */
export function getHealthFactorStatusLabel(
  healthFactor: number | string | null | undefined,
  hasBorrows?: boolean
): HealthFactorStatusLabel | null {
  const status = getHealthFactorStatus(healthFactor, hasBorrows);
  if (status === null) return null;
  const labels: Record<Exclude<HealthFactorStatus, null>, { label: string; ariaLabel: string }> = {
    safe: { label: "Safe", ariaLabel: "Your loan is healthy" },
    warning: {
      label: "Warning – consider repaying",
      ariaLabel: "Health factor is in warning range; consider repaying to reduce liquidation risk",
    },
    danger: {
      label: "Danger – at risk of liquidation",
      ariaLabel: "Health factor is below 1; you are at risk of liquidation",
    },
  };
  const { label, ariaLabel } = labels[status];
  return { status, label, ariaLabel };
}

/**
 * Format health factor for display in UI (e.g. preview before/after).
 * Returns "∞" or "No borrows (N/A)" when there is no borrow or HF is infinite.
 */
export function formatHealthFactorDisplay(
  healthFactor: number | string | null | undefined,
  hasBorrows?: boolean
): string {
  if (healthFactor == null || healthFactor === "") {
    return hasBorrows ? "—" : "No borrows (N/A)";
  }
  const value =
    typeof healthFactor === "string" ? Number.parseFloat(healthFactor) : Number(healthFactor);
  if (Number.isNaN(value)) return hasBorrows ? "—" : "No borrows (N/A)";
  if (value === Infinity || value >= 1e10) return "∞";
  return value.toFixed(2);
}
