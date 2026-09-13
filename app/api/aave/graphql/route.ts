import { NextResponse } from "next/server";

const AAVE_GRAPHQL_URL = "https://api.v3.aave.com/graphql";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function fetchWithRetry(
  body: string
): Promise<{ data: string; status: number; contentType: string }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const upstream = await fetch(AAVE_GRAPHQL_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body,
        cache: "no-store",
      });

      const data = await upstream.text();

      // Retry on 5xx server errors (not 4xx client errors)
      if (upstream.status >= 500 && attempt < MAX_RETRIES) {
        console.warn(
          `Aave API returned ${upstream.status} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying...`
        );
        const jitter = Math.random() * 200;
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt + jitter));
        continue;
      }

      return {
        data,
        status: upstream.status,
        contentType: upstream.headers.get("content-type") ?? "application/json",
      };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        console.warn(`Aave API fetch failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, error);
        const jitter = Math.random() * 200;
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt + jitter));
        continue;
      }
    }
  }

  throw lastError ?? new Error("All retries exhausted");
}

const EMPTY_PAGINATED_RESULT = JSON.stringify({
  data: {
    value: {
      __typename: "PaginatedVaultsResult",
      items: [],
      pageInfo: { __typename: "PaginatedResultInfo", prev: null, next: null },
    },
  },
});

/**
 * The @aave/react SDK fires UserVaults and Vaults queries with an empty
 * request object ({}) before the wallet address is available. Aave's API
 * rejects these with "field user is required". Short-circuit them here so
 * the API call is never made and no error surfaces to the client.
 */
function earlyReturnForEmptyVaultQueries(rawBody: string): NextResponse | null {
  if (!rawBody.includes("Vaults")) return null;

  try {
    const parsed = JSON.parse(rawBody);
    const opName: string = parsed?.operationName ?? "";
    const req = parsed?.variables?.request;

    const isVaultListOp = opName === "UserVaults" || opName === "Vaults";
    const hasNoUser = !req?.user && !req?.criteria && !req?.deployer;

    if (isVaultListOp && hasNoUser) {
      return NextResponse.json(JSON.parse(EMPTY_PAGINATED_RESULT), {
        status: 200,
        headers: { "cache-control": "no-store" },
      });
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { error: "Invalid content-type; expected application/json" },
      { status: 415 }
    );
  }

  try {
    const body = await request.text();
    if (!body) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    const earlyReturn = earlyReturnForEmptyVaultQueries(body);
    if (earlyReturn) return earlyReturn;

    const { data, status, contentType: upstreamContentType } = await fetchWithRetry(body);

    if (status >= 500) {
      console.error(`Aave API returned ${status} after all retries:`, data.slice(0, 500));
      return NextResponse.json(
        {
          errors: [
            {
              message: data.includes("panic") ? "Service panicked" : `Aave API error (${status})`,
              extensions: { upstream: data.slice(0, 500) },
            },
          ],
        },
        { status: 200, headers: { "cache-control": "no-store" } }
      );
    }

    return new NextResponse(data, {
      status,
      headers: {
        "content-type": upstreamContentType,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Aave proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch from Aave API" }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "POST" } }
  );
}
