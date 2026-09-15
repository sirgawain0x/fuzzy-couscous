import { NextResponse } from "next/server";

import {
  buildTradeDenialResponse,
  createAttestationCookieHeader,
  evaluateGeoAccess,
  getRequestCountry,
} from "@/lib/trade/eligibility";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const country = getRequestCountry(request);
  const geo = evaluateGeoAccess(country);
  if (!geo.allowed) {
    return buildTradeDenialResponse(geo.reason ?? "geo_unknown", country);
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.headers.append("Set-Cookie", createAttestationCookieHeader());
  return response;
}
