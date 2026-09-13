export function formatPercent(value?: string | number | null, fallback = "—") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;

  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return `${numeric.toFixed(2)}%`;
}

export function formatUsd(value?: string | number | null, fallback = "—") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;

  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numeric >= 1 ? 2 : 4,
  }).format(numeric);
}

export function formatDateMs(timestampMs?: number | null, fallback = "—") {
  if (!timestampMs) {
    return fallback;
  }

  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
