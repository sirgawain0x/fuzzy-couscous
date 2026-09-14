import { NextRequest, NextResponse } from "next/server";
import { requireAuthedWallet } from "@/lib/apiAuth";
import { PRIVY_EARN_VAULT_ID } from "@/lib/config/privyEarn";
import { getEarnPosition, resolveEmbeddedWalletId, toEarnHttpError } from "@/lib/privyEarn";

export async function GET(request: NextRequest) {
  const auth = await requireAuthedWallet(request);
  if (!auth.ok) return auth.response;

  try {
    const walletId = await resolveEmbeddedWalletId(auth.session.userId, auth.session.walletAddress);
    const position = await getEarnPosition(walletId, PRIVY_EARN_VAULT_ID);
    return NextResponse.json(position);
  } catch (error) {
    const mapped = toEarnHttpError(error, "Failed to load vault position");
    console.error("[earn/position] GET failed:", mapped.message);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
