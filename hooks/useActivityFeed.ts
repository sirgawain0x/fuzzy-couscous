import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useQuery } from "@tanstack/react-query";

export function useActivityFeed() {
  const { wallet } = useWallet();
  return useQuery({
    queryKey: ["walletActivity", wallet?.address],
    queryFn: async () => {
      const response = await wallet?.transfers({ tokens: "usdc", status: "successful" });
      return {
        events: (response?.data ?? []).map((t) => ({
          from_address: t.sender?.address ?? "",
          to_address: t.recipient?.address ?? "",
          // Fall back to transferId so React keys stay unique when no on-chain hash
          transaction_hash: t.onChain?.txId ?? t.transferId ?? "",
          timestamp: t.completedAt,
          amount: t.token?.amount ?? "0",
          token_symbol: t.token?.symbol,
        })),
      };
    },
    enabled: !!wallet?.address,
    refetchOnMount: true,
  });
}
