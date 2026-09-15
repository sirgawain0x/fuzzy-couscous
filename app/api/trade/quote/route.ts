import { NextResponse } from "next/server";
import { isAddress } from "viem";

import { ROBINHOOD_CHAIN_ID, ZERO_EX_SWAP_BASE_URL } from "@/lib/config/robinhood";
import { assertTradeAccess } from "@/lib/trade/eligibility";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type QuoteMode = "price" | "quote";

const parseMode = (value: string | null): QuoteMode => {
  if (value === "quote") return "quote";
  return "price";
};

export async function GET(request: Request) {
  const denied = assertTradeAccess(request);
  if (denied) return denied;

  const apiKey = process.env.ZERO_EX_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ZERO_EX_API_KEY is not configured. Add it to the server environment to enable trading quotes.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { searchParams } = new URL(request.url);
  const sellToken = searchParams.get("sellToken");
  const buyToken = searchParams.get("buyToken");
  const sellAmount = searchParams.get("sellAmount");
  const taker = searchParams.get("taker");
  const mode = parseMode(searchParams.get("mode"));

  if (!sellToken || !isAddress(sellToken)) {
    return NextResponse.json(
      { error: "Invalid or missing sellToken" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!buyToken || !isAddress(buyToken)) {
    return NextResponse.json(
      { error: "Invalid or missing buyToken" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!sellAmount || !/^\d+$/.test(sellAmount) || BigInt(sellAmount) <= 0n) {
    return NextResponse.json(
      { error: "Invalid or missing sellAmount (wei integer required)" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (mode === "quote" && (!taker || !isAddress(taker))) {
    return NextResponse.json(
      { error: "taker address is required for a firm quote" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const params = new URLSearchParams({
    chainId: String(ROBINHOOD_CHAIN_ID),
    sellToken,
    buyToken,
    sellAmount,
  });
  if (taker && isAddress(taker)) {
    params.set("taker", taker);
  }

  const endpoint = mode === "quote" ? "quote" : "price";
  const url = `${ZERO_EX_SWAP_BASE_URL}/${endpoint}?${params.toString()}`;

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "0x-api-key": apiKey,
        "0x-version": "v2",
      },
      cache: "no-store",
    });

    const text = await upstream.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { error: text || "Invalid upstream response" };
    }

    return NextResponse.json(body, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `0x quote unavailable: ${message}` },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
