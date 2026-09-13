"use server";

import { getUsdcAddress } from "@/lib/usdc";

type ActivityEvent = {
  from_address: string;
  to_address: string;
  transaction_hash: string;
  timestamp: string;
  amount: string;
  token_symbol: string;
};

type AlchemyTransfer = {
  hash?: string;
  from?: string;
  to?: string;
  value?: number | null;
  asset?: string;
  metadata?: { blockTimestamp?: string };
};

/**
 * Fetches recent USDC transfer activity for a wallet via Alchemy (when configured).
 */
export async function getWalletActivity(
  walletAddress: string
): Promise<{ events: ActivityEvent[] }> {
  if (!walletAddress) return { events: [] };

  const alchemyKey = process.env.ALCHEMY_API_KEY?.trim();
  if (!alchemyKey) return { events: [] };

  const chain = process.env.NODE_ENV === "production" ? "base-mainnet" : "base-sepolia";
  const usdcAddress = getUsdcAddress().toLowerCase();

  try {
    const response = await fetch(`https://${chain}.g.alchemy.com/v2/${alchemyKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            contractAddresses: [usdcAddress],
            category: ["erc20"],
            withMetadata: true,
            maxCount: "0x32",
            order: "desc",
            fromAddress: walletAddress,
          },
        ],
      }),
    });

    const incomingResponse = await fetch(`https://${chain}.g.alchemy.com/v2/${alchemyKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            contractAddresses: [usdcAddress],
            category: ["erc20"],
            withMetadata: true,
            maxCount: "0x32",
            order: "desc",
            toAddress: walletAddress,
          },
        ],
      }),
    });

    const [outgoingData, incomingData] = await Promise.all([
      response.json(),
      incomingResponse.json(),
    ]);

    const outgoing = (outgoingData?.result?.transfers ?? []) as AlchemyTransfer[];
    const incoming = (incomingData?.result?.transfers ?? []) as AlchemyTransfer[];

    const events: ActivityEvent[] = [...outgoing, ...incoming]
      .map((transfer) => ({
        from_address: transfer.from ?? "",
        to_address: transfer.to ?? "",
        transaction_hash: transfer.hash ?? "",
        timestamp: transfer.metadata?.blockTimestamp ?? new Date().toISOString(),
        amount: transfer.value != null ? String(transfer.value) : "0",
        token_symbol: transfer.asset ?? "USDC",
      }))
      .filter((event) => event.transaction_hash && event.from_address && event.to_address)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const seen = new Set<string>();
    const unique = events.filter((event) => {
      const key = `${event.transaction_hash}:${event.from_address}:${event.to_address}:${event.amount}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { events: unique.slice(0, 50) };
  } catch (error) {
    console.error("[getWalletActivity] Failed:", error);
    return { events: [] };
  }
}
