import { useQuery } from "@tanstack/react-query";
import { useAppWallet } from "@/hooks/useAppWallet";
import { getWalletActivity } from "@/server-actions/getWalletActivity";

export function useActivityFeed() {
  const { address } = useAppWallet();

  return useQuery({
    queryKey: ["walletActivity", address],
    queryFn: async () => {
      if (!address) return { events: [] };
      return getWalletActivity(address);
    },
    enabled: !!address,
    refetchOnMount: true,
  });
}
