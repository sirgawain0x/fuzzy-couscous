import { NextRequest, NextResponse } from "next/server";
import { requireAuthedWallet } from "@/lib/apiAuth";
import { PRIVY_EARN_VAULT_ID } from "@/lib/config/privyEarn";
import {
  depositEarn,
  isPositiveDecimalAmount,
  resolveEmbeddedWalletId,
  toEarnHttpError,
} from "@/lib/privyEarn";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const amount =
    body && typeof body === "object" && "amount" in body
      ? (body as { amount?: unknown }).amount
      : null;

  if (typeof amount !== "string" || !isPositiveDecimalAmount(amount)) {
    return NextResponse.json({ error: "Enter a valid deposit amount" }, { status: 400 });
  }

  const auth = await requireAuthedWallet(request);
  if (!auth.ok) return auth.response;

  try {
    const walletId = await resolveEmbeddedWalletId(auth.session.userId, auth.session.walletAddress);
    const action = await depositEarn({
      walletId,
      accessToken: auth.session.accessToken,
      amount,
      vaultId: PRIVY_EARN_VAULT_ID,
    });
    return NextResponse.json(action);
  } catch (error) {
    const mapped = toEarnHttpError(error, "Deposit failed");
    console.error("[earn/deposit] POST failed:", mapped.message);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
