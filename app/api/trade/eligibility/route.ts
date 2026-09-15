import { NextResponse } from "next/server";

import { evaluateGeoAccess, getRequestCountry, hasTradeAttestation } from "@/lib/trade/eligibility";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const country = getRequestCountry(request);
  const geo = evaluateGeoAccess(country);
  const attested = hasTradeAttestation(request);

  return NextResponse.json(
    {
      allowed: geo.allowed,
      country,
      attested,
      ...(geo.reason ? { reason: geo.reason } : {}),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
