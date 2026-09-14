import { NextRequest, NextResponse } from "next/server";
import { requireAuthedWallet } from "@/lib/apiAuth";
import { getEarnAction, resolveEmbeddedWalletId, toEarnHttpError } from "@/lib/privyEarn";

const ACTION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthedWallet(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!ACTION_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid action id" }, { status: 400 });
  }

  try {
    const walletId = await resolveEmbeddedWalletId(auth.session.userId, auth.session.walletAddress);
    const action = await getEarnAction(walletId, id);
    return NextResponse.json(action);
  } catch (error) {
    const mapped = toEarnHttpError(error, "Failed to load action status");
    console.error("[earn/actions] GET failed:", mapped.message);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
