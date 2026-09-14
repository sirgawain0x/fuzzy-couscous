"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { erc20Abi, formatUnits, maxUint256, parseUnits, type Address, type Hex } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
  useWriteContract,
} from "wagmi";

import {
  RHJ_DOCS_URL,
  ROBINHOOD_CHAIN_ID,
  STOCK_TOKEN_DECIMALS,
  USDG_ADDRESS,
  USDG_DECIMALS,
  USDG_SYMBOL,
  robinhoodChain,
} from "@/lib/config/robinhood";
import { formatUsdDisplay, isLikelyUntradable } from "@/lib/trade/pricing";
import type { StockTokenAsset, ZeroExQuoteResponse } from "@/lib/trade/types";
import {
  normalizeTxErrorMessage,
  showTxErrorToast,
  showTxSuccessToast,
} from "@/lib/transactionToast";

type TradeDirection = "buy" | "sell";

type AssetsResponse = {
  assets?: StockTokenAsset[];
  error?: string;
};

const DEBOUNCE_MS = 450;

const formatTokenAmount = (raw: string | undefined, decimals: number, digits = 6): string => {
  if (!raw) return "—";
  try {
    const value = Number(formatUnits(BigInt(raw), decimals));
    if (!Number.isFinite(value)) return "—";
    return value.toLocaleString(undefined, {
      maximumFractionDigits: digits,
    });
  } catch {
    return "—";
  }
};

export function TradeSwapPanel({ walletAddress }: { walletAddress: string | null }) {
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_CHAIN_ID });
  const { data: walletClient } = useWalletClient({ chainId: ROBINHOOD_CHAIN_ID });
  const { address: accountAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [assets, setAssets] = useState<StockTokenAsset[]>([]);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StockTokenAsset | null>(null);
  const [direction, setDirection] = useState<TradeDirection>("buy");
  const [amount, setAmount] = useState("");
  const [priceQuote, setPriceQuote] = useState<ZeroExQuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usdgBalance, setUsdgBalance] = useState<bigint | null>(null);
  const [stockBalance, setStockBalance] = useState<bigint | null>(null);

  const isOnRobinhood = chainId === ROBINHOOD_CHAIN_ID;
  const taker = (walletAddress ?? accountAddress ?? null) as Address | null;

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (asset) =>
        asset.tokenSymbol.toLowerCase().includes(q) || asset.tokenName.toLowerCase().includes(q)
    );
  }, [assets, search]);

  const sellToken = direction === "buy" ? USDG_ADDRESS : selected?.contractAddress;
  const buyToken = direction === "buy" ? selected?.contractAddress : USDG_ADDRESS;
  const sellDecimals = direction === "buy" ? USDG_DECIMALS : STOCK_TOKEN_DECIMALS;
  const buyDecimals = direction === "buy" ? STOCK_TOKEN_DECIMALS : USDG_DECIMALS;

  const sellAmountRaw = useMemo(() => {
    const trimmed = amount.trim();
    if (!trimmed || Number(trimmed) <= 0) return null;
    try {
      return parseUnits(trimmed, sellDecimals).toString();
    } catch {
      return null;
    }
  }, [amount, sellDecimals]);

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    setAssetsError(null);
    try {
      const res = await fetch("/api/trade/assets");
      const data = (await res.json()) as AssetsResponse;
      if (!res.ok) {
        throw new Error(data.error || "Failed to load stock tokens");
      }
      const list = data.assets ?? [];
      setAssets(list);
      setSelected((prev) => {
        if (prev) {
          const refreshed = list.find((a) => a.contractAddress === prev.contractAddress);
          return refreshed ?? list[0] ?? null;
        }
        return list[0] ?? null;
      });
    } catch (error) {
      setAssetsError(error instanceof Error ? error.message : "Failed to load assets");
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const refreshBalances = useCallback(async () => {
    if (!taker || !publicClient || !selected) {
      setUsdgBalance(null);
      setStockBalance(null);
      return;
    }
    try {
      const [usdg, stock] = await Promise.all([
        publicClient.readContract({
          address: USDG_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [taker],
        }),
        publicClient.readContract({
          address: selected.contractAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [taker],
        }),
      ]);
      setUsdgBalance(usdg);
      setStockBalance(stock);
    } catch {
      setUsdgBalance(null);
      setStockBalance(null);
    }
  }, [publicClient, selected, taker]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances, isOnRobinhood]);

  useEffect(() => {
    if (!sellToken || !buyToken || !sellAmountRaw || !selected) {
      setPriceQuote(null);
      setQuoteError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsQuoting(true);
      setQuoteError(null);
      try {
        const params = new URLSearchParams({
          mode: "price",
          sellToken,
          buyToken,
          sellAmount: sellAmountRaw,
        });
        if (taker) params.set("taker", taker);
        const res = await fetch(`/api/trade/quote?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as ZeroExQuoteResponse & {
          error?: string;
          reason?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || data.reason || `Quote failed (${res.status})`);
        }
        setPriceQuote(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setPriceQuote(null);
        setQuoteError(error instanceof Error ? error.message : "Unable to fetch indicative price");
      } finally {
        if (!controller.signal.aborted) setIsQuoting(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [buyToken, sellAmountRaw, sellToken, selected, taker]);

  const handleSwitchChain = async () => {
    try {
      await switchChainAsync({ chainId: ROBINHOOD_CHAIN_ID });
    } catch (error) {
      showTxErrorToast({
        title: "Network switch failed",
        description: normalizeTxErrorMessage(error, "Could not switch to Robinhood Chain"),
      });
    }
  };

  const handleFlipDirection = () => {
    setDirection((prev) => (prev === "buy" ? "sell" : "buy"));
    setAmount("");
    setPriceQuote(null);
  };

  const handleSelectAsset = (asset: StockTokenAsset) => {
    setSelected(asset);
    setPriceQuote(null);
  };

  const handleMax = () => {
    if (direction === "buy" && usdgBalance != null) {
      setAmount(formatUnits(usdgBalance, USDG_DECIMALS));
      return;
    }
    if (direction === "sell" && stockBalance != null) {
      setAmount(formatUnits(stockBalance, STOCK_TOKEN_DECIMALS));
    }
  };

  const handleSwap = async () => {
    if (!taker || !sellToken || !buyToken || !sellAmountRaw || !selected) return;
    if (!isOnRobinhood) {
      await handleSwitchChain();
      return;
    }
    if (!walletClient || !publicClient) {
      showTxErrorToast({
        title: "Wallet unavailable",
        description: "Connect a wallet that can sign on Robinhood Chain.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const quoteParams = new URLSearchParams({
        mode: "quote",
        sellToken,
        buyToken,
        sellAmount: sellAmountRaw,
        taker,
      });
      const quoteRes = await fetch(`/api/trade/quote?${quoteParams.toString()}`);
      const quote = (await quoteRes.json()) as ZeroExQuoteResponse & {
        error?: string;
        reason?: string;
      };
      if (!quoteRes.ok) {
        throw new Error(quote.error || quote.reason || `Firm quote failed (${quoteRes.status})`);
      }
      if (!quote.transaction?.to || !quote.transaction.data) {
        throw new Error("0x quote did not include transaction calldata");
      }

      const spender =
        quote.issues?.allowance?.spender || quote.allowanceTarget || quote.transaction.to;
      const requiredSell = BigInt(sellAmountRaw);
      const currentAllowance = await publicClient.readContract({
        address: sellToken,
        abi: erc20Abi,
        functionName: "allowance",
        args: [taker, spender],
      });

      if (currentAllowance < requiredSell) {
        const approveHash = await writeContractAsync({
          chainId: ROBINHOOD_CHAIN_ID,
          address: sellToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        showTxSuccessToast({
          title: "Approval confirmed",
          description: `Approved ${direction === "buy" ? USDG_SYMBOL : selected.tokenSymbol} for trading`,
          txHash: approveHash,
          chainId: ROBINHOOD_CHAIN_ID,
        });
      }

      const txHash = await walletClient.sendTransaction({
        chain: robinhoodChain,
        account: taker,
        to: quote.transaction.to,
        data: quote.transaction.data as Hex,
        value: BigInt(quote.transaction.value || "0"),
        gas: quote.transaction.gas ? BigInt(quote.transaction.gas) : undefined,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      showTxSuccessToast({
        title: "Trade submitted",
        description:
          direction === "buy"
            ? `Bought ${selected.tokenSymbol} with ${USDG_SYMBOL}`
            : `Sold ${selected.tokenSymbol} for ${USDG_SYMBOL}`,
        txHash,
        chainId: ROBINHOOD_CHAIN_ID,
      });
      setAmount("");
      setPriceQuote(null);
      await refreshBalances();
    } catch (error) {
      showTxErrorToast({
        title: "Trade failed",
        description: normalizeTxErrorMessage(error, "Unable to complete swap"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryDisabled =
    isSubmitting ||
    isSwitching ||
    assetsLoading ||
    !selected ||
    (!isOnRobinhood ? false : !sellAmountRaw || !!quoteError || isQuoting);

  const primaryLabel = (() => {
    if (!walletAddress) return "Connect wallet to trade";
    if (!isOnRobinhood) return isSwitching ? "Switching…" : "Switch to Robinhood Chain";
    if (isSubmitting) return "Submitting…";
    if (isQuoting) return "Fetching quote…";
    if (!sellAmountRaw) return "Enter an amount";
    return direction === "buy"
      ? `Buy ${selected?.tokenSymbol ?? ""}`
      : `Sell ${selected?.tokenSymbol ?? ""}`;
  })();

  const untradableHint =
    selected && isLikelyUntradable(selected.tradingCapabilities?.fractionalTradability)
      ? "Underlying marks fractional trading as untradable — check session status before trading."
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Stock Tokens</h2>
          <button
            type="button"
            onClick={() => void loadAssets()}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            aria-label="Refresh stock token list"
          >
            Refresh
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="AAPL, NVDA, SPY…"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            aria-label="Search stock tokens"
          />
        </label>
        {assetsLoading ? (
          <p className="text-sm text-slate-500">Loading Robinhood Stock Tokens…</p>
        ) : assetsError ? (
          <p className="text-sm text-red-600" role="alert">
            {assetsError}
          </p>
        ) : (
          <ul
            className="max-h-[28rem] space-y-2 overflow-y-auto pr-1"
            role="listbox"
            aria-label="Stock token assets"
          >
            {filteredAssets.map((asset) => {
              const isActive = selected?.contractAddress === asset.contractAddress;
              return (
                <li key={asset.contractAddress}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    tabIndex={0}
                    aria-label={`Select ${asset.tokenSymbol}`}
                    onClick={() => handleSelectAsset(asset)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <img
                      src={asset.logoUrl}
                      alt=""
                      className="h-9 w-9 rounded-full bg-slate-100 object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{asset.tokenSymbol}</span>
                        {asset.isTradingHalt ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              isActive ? "bg-white/20" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            Halt
                          </span>
                        ) : null}
                      </div>
                      <div
                        className={`truncate text-xs ${isActive ? "text-white/80" : "text-slate-500"}`}
                      >
                        {asset.tokenName}
                      </div>
                    </div>
                    <div
                      className={`text-right text-xs ${isActive ? "text-white/90" : "text-slate-600"}`}
                    >
                      <div>{formatUsdDisplay(asset.tokenAskUsd)}</div>
                      <div className={isActive ? "text-white/60" : "text-slate-400"}>
                        token est.
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-slate-500">
          Displayed token USD estimates apply the RHJ corporate-action multiplier to raw underlier
          bid/ask. Execution prices come from 0x RFQ.
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Swap</h2>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            Robinhood · {ROBINHOOD_CHAIN_ID}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>{direction === "buy" ? "You pay" : "You sell"}</span>
            <button
              type="button"
              onClick={handleMax}
              className="font-semibold text-slate-700 underline-offset-2 hover:underline"
              aria-label="Use maximum balance"
            >
              Max
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-transparent text-2xl font-semibold text-slate-900 outline-none"
              aria-label="Swap amount"
            />
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-800">
              {direction === "buy" ? USDG_SYMBOL : (selected?.tokenSymbol ?? "—")}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Balance:{" "}
            {direction === "buy"
              ? usdgBalance != null
                ? formatUnits(usdgBalance, USDG_DECIMALS)
                : "—"
              : stockBalance != null
                ? formatUnits(stockBalance, STOCK_TOKEN_DECIMALS)
                : "—"}
          </p>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleFlipDirection}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            aria-label="Flip buy and sell direction"
          >
            Flip direction
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 text-xs text-slate-500">You receive (indicative)</div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-2xl font-semibold text-slate-900">
              {formatTokenAmount(priceQuote?.buyAmount, buyDecimals)}
            </span>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-800">
              {direction === "buy" ? (selected?.tokenSymbol ?? "—") : USDG_SYMBOL}
            </span>
          </div>
          {selected && direction === "buy" ? (
            <p className="mt-2 text-xs text-slate-500">
              Stock tokens use 18 decimals. Share-equivalent ≈ raw amount × multiplier (
              {selected.currentMultiplier}).
            </p>
          ) : null}
        </div>

        {selected?.isTradingHalt ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">
            Trading halt flagged for {selected.tokenSymbol}. Quotes may fail until the halt clears.
          </p>
        ) : null}
        {untradableHint ? (
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700" role="status">
            {untradableHint}
          </p>
        ) : null}
        {quoteError ? (
          <p className="text-sm text-red-600" role="alert">
            {quoteError}
          </p>
        ) : null}

        <button
          type="button"
          disabled={primaryDisabled || !walletAddress}
          onClick={() => void handleSwap()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary rounded-full px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={primaryLabel}
        >
          {primaryLabel}
        </button>

        <aside className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-5 text-amber-950">
          <p className="font-semibold">Eligibility notice</p>
          <p className="mt-1">
            Robinhood Stock Tokens are not offered to U.S. persons or in certain other restricted
            jurisdictions. Review the issuer disclosures before trading.
          </p>
          <a
            href={RHJ_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex font-semibold underline underline-offset-2"
          >
            Robinhood RHJ documentation
          </a>
        </aside>
      </section>
    </div>
  );
}
