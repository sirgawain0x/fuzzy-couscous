import { NextResponse } from "next/server";

type AllowedChain = "mainnet" | "base" | "base-sepolia";

const ALLOWED_CHAINS: ReadonlySet<AllowedChain> = new Set(["mainnet", "base", "base-sepolia"]);

/** Return an ordered list of upstream RPC URLs to try (first = highest priority). */
const getOrderedRpcUrls = (chain: AllowedChain): string[] => {
  const alchemyKey = process.env.ALCHEMY_API_KEY?.trim();
  const urls: string[] = [];

  if (chain === "mainnet") {
    if (alchemyKey) urls.push(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`);
    const custom = process.env.MAINNET_RPC_URL?.trim();
    if (custom) urls.push(custom);
    // Public fallback
    urls.push("https://eth.llamarpc.com");
  } else if (chain === "base") {
    if (alchemyKey) urls.push(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`);
    const custom = process.env.BASE_RPC_URL?.trim();
    if (custom) urls.push(custom);
    urls.push("https://mainnet.base.org");
  } else if (chain === "base-sepolia") {
    if (alchemyKey) urls.push(`https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`);
    const custom = process.env.BASE_SEPOLIA_RPC_URL?.trim();
    if (custom) urls.push(custom);
    urls.push("https://sepolia.base.org");
  }

  // Deduplicate while preserving order
  return [...new Set(urls)];
};

/** Status codes that should trigger a fallback to the next RPC URL. */
const isRetryableStatus = (status: number): boolean =>
  status === 403 || status === 429 || status >= 500;

export async function POST(request: Request, context: { params: Promise<{ chain: string }> }) {
  const { chain } = await context.params;

  if (!ALLOWED_CHAINS.has(chain as AllowedChain)) {
    return NextResponse.json(
      { error: "Unsupported chain" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rpcUrls = getOrderedRpcUrls(chain as AllowedChain);
  if (rpcUrls.length === 0) {
    return NextResponse.json(
      { error: "RPC upstream is not configured" },
      { status: 500, headers: { "Cache-Control": "no-store", "x-rpc-proxy": "true" } }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { error: "Invalid content-type; expected application/json" },
      { status: 415, headers: { "Cache-Control": "no-store", "x-rpc-proxy": "true" } }
    );
  }

  const requestBodyText = await request.text();
  if (!requestBodyText) {
    return NextResponse.json(
      { error: "Missing request body" },
      { status: 400, headers: { "Cache-Control": "no-store", "x-rpc-proxy": "true" } }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(requestBodyText);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: { "Cache-Control": "no-store", "x-rpc-proxy": "true" } }
    );
  }

  // Basic JSON-RPC shape check (don’t fully validate; forward most payloads as-is)
  const isObject = typeof parsed === "object" && parsed !== null;
  const isBatch = Array.isArray(parsed);
  if (!isObject && !isBatch) {
    return NextResponse.json(
      { error: "Invalid JSON-RPC payload" },
      { status: 400, headers: { "Cache-Control": "no-store", "x-rpc-proxy": "true" } }
    );
  }

  // Try each upstream URL in order; fall back on retryable errors (403, 429, 5xx).
  let lastResponse: { text: string; status: number; contentType: string } | null = null;

  for (const url of rpcUrls) {
    try {
      const upstreamResponse = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: requestBodyText,
        cache: "no-store",
      });

      const upstreamText = await upstreamResponse.text();
      lastResponse = {
        text: upstreamText,
        status: upstreamResponse.status,
        contentType: upstreamResponse.headers.get("content-type") ?? "application/json",
      };

      if (!isRetryableStatus(upstreamResponse.status)) {
        break; // Success or non-retryable client error — return immediately
      }
      // Retryable status — try next URL
    } catch {
      // Network error (DNS failure, timeout, etc.) — try next URL
    }
  }

  if (!lastResponse) {
    return NextResponse.json(
      { error: "All RPC upstreams failed" },
      { status: 502, headers: { "Cache-Control": "no-store", "x-rpc-proxy": "true" } }
    );
  }

  return new NextResponse(lastResponse.text, {
    status: lastResponse.status,
    headers: {
      "content-type": lastResponse.contentType,
      "cache-control": "no-store",
      "x-rpc-proxy": "true",
    },
  });
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } }
  );
}
