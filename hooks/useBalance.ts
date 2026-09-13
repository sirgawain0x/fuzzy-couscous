import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@crossmint/client-sdk-react-ui";

export function useBalance() {
  const { wallet } = useWallet();
  const {
    data: balances = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["balances", wallet?.address],
    queryFn: async () => (await wallet?.balances(["usdc"])) ?? null,
  });

  const raw = balances?.usdc?.amount ?? "0";
  // Floor to 2 decimals so we never display more than what's actually available.
  // toFixed(2) can round UP (e.g. 488.7596 → "488.76"), making send-full-balance fail.
  // Use string-based truncation to avoid floating-point precision issues.
  const parts = raw.split(".");
  const floored = parts[0] + "." + (parts[1] || "").padEnd(2, "0").slice(0, 2);

  return {
    balances,
    rawBalance: raw,
    displayableBalance: floored,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    isLoading,
    refetch,
  };
}
