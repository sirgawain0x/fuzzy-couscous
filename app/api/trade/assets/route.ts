import { NextResponse } from "next/server";
import { getAddress, isAddress, type Address } from "viem";

import {
  RHJ_ASSETS_URL,
  RHJ_PRICES_URL,
  ROBINHOOD_CHAIN_ID,
  TRADE_WATCHLIST_SYMBOLS,
} from "@/lib/config/robinhood";
import { applyMultiplierToPrice } from "@/lib/trade/pricing";
import type { StockTokenAsset, StockTokenTradingCapabilities } from "@/lib/trade/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RhjDeployment = {
  contractAddress: string;
  chainId: number;
};

type RhjAsset = {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  deployments?: RhjDeployment[];
  currentMultiplier?: string;
  pendingMultiplier?: string;
  logoUrl?: string;
  status?: string;
  tradingCapabilities?: StockTokenTradingCapabilities | null;
};

type RhjAssetsResponse = {
  assets?: RhjAsset[];
};

type RhjQuote = {
  tokenSymbol: string;
  bid?: string;
  ask?: string;
  isTradingHalt?: boolean;
};

type RhjPricesResponse = {
  quotes?: RhjQuote[];
};

const WATCHLIST_SET = new Set<string>(TRADE_WATCHLIST_SYMBOLS);

const toAsset = (asset: RhjAsset): StockTokenAsset | null => {
  const deployment = asset.deployments?.find((d) => d.chainId === ROBINHOOD_CHAIN_ID);
  if (!deployment || !isAddress(deployment.contractAddress)) {
    return null;
  }
  if (asset.status && asset.status !== "ASSET_STATUS_ACTIVE") {
    return null;
  }

  return {
    id: asset.id,
    tokenSymbol: asset.tokenSymbol,
    tokenName: asset.tokenName,
    contractAddress: getAddress(deployment.contractAddress) as Address,
    chainId: ROBINHOOD_CHAIN_ID,
    logoUrl:
      asset.logoUrl ||
      `https://cdn.robinhood.com/ncw_assets/logos/${deployment.contractAddress.toLowerCase()}.png`,
    currentMultiplier: asset.currentMultiplier ?? "1",
    pendingMultiplier: asset.pendingMultiplier || undefined,
    status: asset.status ?? "ASSET_STATUS_ACTIVE",
    tradingCapabilities: asset.tradingCapabilities ?? null,
  };
};

const fetchPricesForSymbols = async (symbols: string[]): Promise<Map<string, RhjQuote>> => {
  const map = new Map<string, RhjQuote>();
  const unique = [...new Set(symbols)].slice(0, 12);

  await Promise.all(
    unique.map(async (symbol) => {
      try {
        const res = await fetch(`${RHJ_PRICES_URL}/${encodeURIComponent(symbol)}`, {
          headers: { accept: "application/json" },
          next: { revalidate: 15 },
        });
        if (!res.ok) return;
        const data = (await res.json()) as RhjPricesResponse;
        const quote = data.quotes?.[0];
        if (quote?.tokenSymbol) {
          map.set(quote.tokenSymbol.toUpperCase(), quote);
        }
      } catch {
        // Price enrichment is best-effort
      }
    })
  );

  return map;
};

export async function GET() {
  try {
    const assetsRes = await fetch(RHJ_ASSETS_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!assetsRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch stock token assets (${assetsRes.status})` },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const payload = (await assetsRes.json()) as RhjAssetsResponse;
    const mapped = (payload.assets ?? [])
      .map(toAsset)
      .filter((asset): asset is StockTokenAsset => asset !== null);

    mapped.sort((a, b) => {
      const aWatch = WATCHLIST_SET.has(a.tokenSymbol) ? 0 : 1;
      const bWatch = WATCHLIST_SET.has(b.tokenSymbol) ? 0 : 1;
      if (aWatch !== bWatch) return aWatch - bWatch;
      return a.tokenSymbol.localeCompare(b.tokenSymbol);
    });

    const priceSymbols = [
      ...TRADE_WATCHLIST_SYMBOLS.filter((s) => mapped.some((a) => a.tokenSymbol === s)),
      ...mapped.slice(0, 8).map((a) => a.tokenSymbol),
    ];
    const prices = await fetchPricesForSymbols(priceSymbols);

    const assets: StockTokenAsset[] = mapped.map((asset) => {
      const quote = prices.get(asset.tokenSymbol.toUpperCase());
      if (!quote) return asset;
      return {
        ...asset,
        bid: quote.bid,
        ask: quote.ask,
        tokenBidUsd: applyMultiplierToPrice(quote.bid, asset.currentMultiplier),
        tokenAskUsd: applyMultiplierToPrice(quote.ask, asset.currentMultiplier),
        isTradingHalt: quote.isTradingHalt,
      };
    });

    return NextResponse.json(
      { assets, chainId: ROBINHOOD_CHAIN_ID },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Stock token assets unavailable: ${message}` },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
