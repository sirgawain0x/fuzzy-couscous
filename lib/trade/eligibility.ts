import { NextResponse } from "next/server";

export const TRADE_ATTEST_COOKIE = "trade_attest";
export const TRADE_ATTEST_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export type TradeDenialCode = "geo_blocked" | "geo_unknown" | "attestation_required";

const BLOCKED_COUNTRIES = new Set(["US"]);

export const getRequestCountry = (request: Request): string | null => {
  const raw = request.headers.get("x-vercel-ip-country")?.trim();
  if (!raw) return null;
  return raw.toUpperCase();
};

export const isGeoBypassEnabled = (): boolean => process.env.TRADE_GEO_BYPASS?.trim() === "1";

export const evaluateGeoAccess = (
  country: string | null
): { allowed: boolean; reason?: TradeDenialCode } => {
  if (isGeoBypassEnabled()) return { allowed: true };

  if (!country) {
    if (process.env.NODE_ENV === "production") {
      return { allowed: false, reason: "geo_unknown" };
    }
    if (process.env.TRADE_GEO_BYPASS?.trim() === "0") {
      return { allowed: false, reason: "geo_unknown" };
    }
    return { allowed: true };
  }

  if (BLOCKED_COUNTRIES.has(country)) {
    return { allowed: false, reason: "geo_blocked" };
  }
  return { allowed: true };
};

export const hasTradeAttestation = (request: Request): boolean => {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const parts = cookieHeader.split(";").map((p) => p.trim());
  return parts.some((p) => p === `${TRADE_ATTEST_COOKIE}=1`);
};

export const buildTradeDenialResponse = (
  code: TradeDenialCode,
  country: string | null
): NextResponse => {
  const messages: Record<TradeDenialCode, string> = {
    geo_blocked: "Trade not available in your region",
    geo_unknown: "Trade not available: region could not be determined",
    attestation_required: "Eligibility attestation required",
  };
  return NextResponse.json(
    { error: messages[code], code, country },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
};

export const assertTradeAccess = (request: Request): NextResponse | null => {
  const country = getRequestCountry(request);
  const geo = evaluateGeoAccess(country);
  if (!geo.allowed) {
    return buildTradeDenialResponse(geo.reason ?? "geo_unknown", country);
  }
  if (!hasTradeAttestation(request)) {
    return buildTradeDenialResponse("attestation_required", country);
  }
  return null;
};

export const createAttestationCookieHeader = (): string => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${TRADE_ATTEST_COOKIE}=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TRADE_ATTEST_MAX_AGE_SEC}${secure}`;
};
