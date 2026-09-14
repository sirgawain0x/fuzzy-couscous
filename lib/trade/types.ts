import type { Address } from "viem";

/** Underlier trading capabilities from RHJ `/assets` (Source fields, nullable). */
export type StockTokenTradingCapabilities = {
  fractionalTradability?: string | null;
  allDayTradability?: string | null;
  extendedHoursFractionalTradability?: boolean | null;
};

export type StockTokenAsset = {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  contractAddress: Address;
  chainId: number;
  logoUrl: string;
  /** Decimal string from RHJ (e.g. "1.000000000000000000") — shares per raw token. */
  currentMultiplier: string;
  pendingMultiplier?: string;
  status: string;
  tradingCapabilities?: StockTokenTradingCapabilities | null;
  /** Raw underlier bid from RHJ `/prices` (NOT multiplier-adjusted). */
  bid?: string;
  /** Raw underlier ask from RHJ `/prices` (NOT multiplier-adjusted). */
  ask?: string;
  /**
   * Token-equivalent USD mid estimate for display:
   * `ask * currentMultiplier` (REST bid/ask are raw underlier prices).
   */
  tokenAskUsd?: string;
  tokenBidUsd?: string;
  isTradingHalt?: boolean;
};

export type ZeroExPriceResponse = {
  buyAmount?: string;
  sellAmount?: string;
  price?: string;
  gas?: string;
  estimatedGas?: string;
  issues?: {
    allowance?: {
      actual: string;
      spender: Address;
    } | null;
    balance?: {
      token: Address;
      actual: string;
      expected: string;
    } | null;
    simulationIncomplete?: boolean;
    invalidSourcesPassed?: string[];
  };
  liquidityAvailable?: boolean;
  totalNetworkFee?: string;
  minBuyAmount?: string;
  tokenMetadata?: {
    buyToken?: { buyTaxBps?: string | null; sellTaxBps?: string | null };
    sellToken?: { buyTaxBps?: string | null; sellTaxBps?: string | null };
  };
};

export type ZeroExQuoteResponse = ZeroExPriceResponse & {
  transaction?: {
    to: Address;
    data: `0x${string}`;
    value: string;
    gas?: string;
    gasPrice?: string;
  };
  allowanceTarget?: Address;
};
