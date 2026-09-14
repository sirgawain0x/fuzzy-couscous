import { NextRequest, NextResponse } from "next/server";
import { requireAuthedWallet } from "@/lib/apiAuth";
import { PRIVY_EARN_VAULT_ID } from "@/lib/config/privyEarn";
import {
  getEarnPosition,
  isPositiveDecimalAmount,
  resolveEmbeddedWalletId,
  toEarnHttpError,
  withdrawEarn,
} from "@/lib/privyEarn";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload =
    body && typeof body === "object" ? (body as { amount?: unknown; max?: unknown }) : {};
  const wantsMax = payload.max === true;
  const amount = typeof payload.amount === "string" ? payload.amount : null;

  if (!wantsMax && (amount == null || !isPositiveDecimalAmount(amount))) {
    return NextResponse.json({ error: "Enter a valid withdraw amount" }, { status: 400 });
  }

  const auth = await requireAuthedWallet(request);
  if (!auth.ok) return auth.response;

  try {
    const walletId = await resolveEmbeddedWalletId(auth.session.userId, auth.session.walletAddress);

    const rawAmount = wantsMax
      ? (await getEarnPosition(walletId, PRIVY_EARN_VAULT_ID)).assetsInVault
      : undefined;

    if (wantsMax && (!rawAmount || rawAmount === "0")) {
      return NextResponse.json({ error: "No assets available to withdraw" }, { status: 400 });
    }

    const action = await withdrawEarn({
      walletId,
      accessToken: auth.session.accessToken,
      amount: wantsMax ? undefined : (amount ?? undefined),
      rawAmount,
      vaultId: PRIVY_EARN_VAULT_ID,
    });
    return NextResponse.json(action);
  } catch (error) {
    const mapped = toEarnHttpError(error, "Withdraw failed");
    console.error("[earn/withdraw] POST failed:", mapped.message);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
