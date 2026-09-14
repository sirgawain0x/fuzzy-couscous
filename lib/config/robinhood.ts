import { defineChain, type Address } from "viem";

/** Robinhood Chain mainnet (Arbitrum Orbit). */
export const ROBINHOOD_CHAIN_ID = 4663 as const;

/**
 * Alchemy Robinhood Chain mainnet endpoints (enable Robinhood on the Alchemy app).
 * HTTP: `https://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}`
 * WS:   `wss://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}`
 *
 * Available Alchemy services on Robinhood (9 of 15):
 * Node API, NFT API, Token API, Prices API, Transfers API, Bundler API,
 * Gas Manager, Websockets, Webhooks.
 * Today: Node HTTP via `/api/rpc/robinhood` (+ optional client HTTP fallback).
 * Later: Websockets and the other listed APIs (not integrated yet).
 */
export const ALCHEMY_ROBINHOOD_HTTP_URL = (apiKey: string) =>
  `https://robinhood-mainnet.g.alchemy.com/v2/${apiKey}`;

export const ALCHEMY_ROBINHOOD_WS_URL = (apiKey: string) =>
  `wss://robinhood-mainnet.g.alchemy.com/v2/${apiKey}`;

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.mainnet.chain.robinhood.com"],
      // Alchemy WS available later: wss://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}
      // (not wired into wagmi yet — SSR-safe HTTP proxy remains primary)
    },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

/** L2 WETH on Robinhood Chain mainnet (reference; v1 pairs use USDG ↔ stock tokens). */
export const WETH_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as Address;

/** USDG — primary quote asset for Stock Token RFQ liquidity on Robinhood Chain. */
export const USDG_ADDRESS = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address;

export const USDG_DECIMALS = 6;
export const USDG_SYMBOL = "USDG";

/** Stock tokens are ERC-20 with 18 decimals. */
export const STOCK_TOKEN_DECIMALS = 18;

/** Future: Uniswap Permit2 on L2 (not required for v1 0x AllowanceHolder swaps). */
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;

export const RHJ_ASSETS_URL = "https://api.robinhood.com/rhj/assets";
export const RHJ_PRICES_URL = "https://api.robinhood.com/rhj/prices";
export const RHJ_DOCS_URL = "https://docs.robinhood.com/rhj";

/** Curated watchlist symbols shown first in the trade UI. */
export const TRADE_WATCHLIST_SYMBOLS = [
  "AAPL",
  "NVDA",
  "GOOGL",
  "MSFT",
  "TSLA",
  "AMZN",
  "META",
  "SPY",
  "QQQ",
] as const;

export const ZERO_EX_SWAP_BASE_URL = "https://api.0x.org/swap/allowance-holder";
