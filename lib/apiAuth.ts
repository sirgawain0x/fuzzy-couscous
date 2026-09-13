import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/cockroachdb";
import { verifyCrossmintJwt } from "@/lib/crossmintAuth";

export type AuthedSession = {
  userId: string;
  walletAddress: string;
};

type AuthResult = { ok: true; session: AuthedSession } | { ok: false; response: NextResponse };

/**
 * Validates a Crossmint JWT and resolves the authed user's wallet from CockroachDB.
 * Token is read from (in order):
 *   1. `Authorization: Bearer <jwt>` header
 *   2. `x-crossmint-auth-token` header
 *   3. `bodyAuthToken` argument (legacy sessionToken field in POST bodies)
 */
export async function requireAuthedWallet(
  request: NextRequest,
  bodyAuthToken?: unknown
): Promise<AuthResult> {
  const token =
    extractBearer(request.headers.get("authorization")) ??
    request.headers.get("x-crossmint-auth-token") ??
    (typeof bodyAuthToken === "string" ? bodyAuthToken : null);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  let userId: string;
  try {
    const verified = await verifyCrossmintJwt(token);
    userId = verified.userId;
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid or expired session" }, { status: 401 }),
    };
  }

  if (!process.env.COCKROACHDB_URL) {
    return {
      ok: false,
      response: NextResponse.json({ error: "User directory unavailable" }, { status: 503 }),
    };
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT wallet_address FROM users WHERE crossmint_user_id = $1 LIMIT 1`,
    [userId]
  );

  if (rows.length === 0 || !rows[0].wallet_address) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No wallet linked to this account" }, { status: 404 }),
    };
  }

  return {
    ok: true,
    session: { userId, walletAddress: String(rows[0].wallet_address).toLowerCase() },
  };
}

/**
 * If the client passed a wallet address (query param or body field), confirm
 * it matches the session's canonical wallet.
 */
export function assertWalletMatches(sessionWallet: string, claimed: unknown): NextResponse | null {
  if (claimed == null || claimed === "") return null;
  if (typeof claimed !== "string") {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  if (claimed.toLowerCase() !== sessionWallet) {
    return NextResponse.json(
      { error: "Wallet address does not match authenticated session" },
      { status: 403 }
    );
  }
  return null;
}

function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() === "bearer" && value) return value.trim();
  return null;
}
