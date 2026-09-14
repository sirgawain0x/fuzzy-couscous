import { NextResponse } from "next/server";
import { getEarnVaultDetails, toEarnHttpError } from "@/lib/privyEarn";
import { PRIVY_EARN_VAULT_ID } from "@/lib/config/privyEarn";

export async function GET() {
  try {
    const vault = await getEarnVaultDetails(PRIVY_EARN_VAULT_ID);
    return NextResponse.json(vault, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    const mapped = toEarnHttpError(error, "Failed to load Privy Earn vault");
    console.error("[earn/vault] GET failed:", mapped.message);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
