import { useQuery } from "@tanstack/react-query";
import { useAppWallet } from "@/hooks/useAppWallet";

export function useBalance() {
  const { wallet } = useAppWallet();
  const {
    data: balances = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["balances", wallet?.address],
    queryFn: async () => (wallet ? await wallet.balances(["usdc"]) : null),
    enabled: Boolean(wallet?.address),
  });

  const raw = balances?.usdc?.amount ?? "0";
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
