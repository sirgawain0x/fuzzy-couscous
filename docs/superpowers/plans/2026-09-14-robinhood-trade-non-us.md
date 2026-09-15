# Robinhood Trade (non-US) + Creative Finance Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate live Robinhood Chain trading for non-U.S. users with Vercel IP geo + attestation cookie gates on `/api/trade/*`, and rename user-facing Creative Bank strings to Creative Finance (including PWA install name).

**Architecture:** Shared `lib/trade/eligibility.ts` resolves `x-vercel-ip-country`, attestation cookie `trade_attest`, and fail-closed rules. New `eligibility` / `attest` routes expose status; `assets` / `quote` call `assertTradeAccess`. `/trade` UI gates on eligibility then attestation before mounting `TradeSwapPanel`. Homepage Trade CTA goes live. Manifest + WalletConnect + listed UI copy → Creative Finance.

**Tech Stack:** Next.js App Router API routes, `NextResponse` cookies, Vercel geo header, existing wagmi/`TradeSwapPanel`/0x RFQ scaffolding. No Jest/Vitest — verify with `pnpm exec tsx` for pure helpers and `curl`/`pnpm build` for integration.

**Spec:** `docs/superpowers/specs/2026-09-14-robinhood-trade-non-us-design.md`

## Global Constraints

- Geo source: Vercel `x-vercel-ip-country` only (v1 deny list: `US`)
- Production: missing country header → deny (`geo_unknown`)
- Non-production: missing country → allow (unless `TRADE_GEO_BYPASS=0`)
- `TRADE_GEO_BYPASS=1` skips geo deny (must not be set in prod)
- Attestation: httpOnly cookie `trade_attest=1`, Secure + SameSite=Lax, Max-Age 30 days; cookie is authoritative
- Do not trust client-only headers for attestation without the cookie
- Branding: user-facing only; leave Solidity / vault deploy names / `CreativeBankBouncer` alone
- Branch: `feature/robinhood-trade-homepage` (base `prod`)

## File map

| File | Responsibility |
| --- | --- |
| `lib/trade/eligibility.ts` | Country resolve, geo allow, cookie parse, deny responses |
| `app/api/trade/eligibility/route.ts` | `GET` status (no attest required) |
| `app/api/trade/attest/route.ts` | `POST` set cookie after geo allow |
| `app/api/trade/assets/route.ts` | Gate with `assertTradeAccess` |
| `app/api/trade/quote/route.ts` | Gate with `assertTradeAccess` |
| `components/trade/TradeEligibilityGate.tsx` | Blocked / attest UI |
| `app/trade/page.tsx` | Wire eligibility gate before swap panel |
| `components/NewProducts.tsx` | Live Trade CTA |
| `app/manifest.ts`, `lib/wagmiConfig.ts`, terms/strategies/lending/vault modal | Creative Finance rename |
| `.env.template` | Document `TRADE_GEO_BYPASS` |

---

### Task 1: Eligibility helper library

**Files:**
- Create: `lib/trade/eligibility.ts`
- Test: verify via `pnpm exec tsx` one-liners (no test runner in repo)

**Interfaces:**
- Produces:
  - `TRADE_ATTEST_COOKIE = "trade_attest"`
  - `TradeDenialCode = "geo_blocked" | "geo_unknown" | "attestation_required"`
  - `getRequestCountry(request: Request): string | null`
  - `isGeoBypassEnabled(): boolean`
  - `evaluateGeoAccess(country: string | null): { allowed: boolean; reason?: TradeDenialCode }`
  - `hasTradeAttestation(request: Request): boolean`
  - `buildTradeDenialResponse(code: TradeDenialCode, country: string | null): NextResponse`
  - `assertTradeAccess(request: Request): NextResponse | null` — null means OK
  - `createAttestationCookieHeader(): string` — `Set-Cookie` value for attest route

- [ ] **Step 1: Implement `lib/trade/eligibility.ts`**

```typescript
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
```

- [ ] **Step 2: Verify geo helper with tsx**

Run:

```bash
pnpm exec tsx -e "
import { evaluateGeoAccess } from './lib/trade/eligibility.ts';
process.env.NODE_ENV = 'production';
delete process.env.TRADE_GEO_BYPASS;
console.log(evaluateGeoAccess('US'));
console.log(evaluateGeoAccess(null));
console.log(evaluateGeoAccess('DE'));
"
```

Expected: `{ allowed: false, reason: 'geo_blocked' }`, `{ allowed: false, reason: 'geo_unknown' }`, `{ allowed: true }`.

- [ ] **Step 3: Commit**

```bash
git add lib/trade/eligibility.ts
git commit -m "Add trade eligibility geo and attestation helpers."
```

---

### Task 2: Eligibility + attest API routes

**Files:**
- Create: `app/api/trade/eligibility/route.ts`
- Create: `app/api/trade/attest/route.ts`

**Interfaces:**
- Consumes: helpers from Task 1
- Produces:
  - `GET /api/trade/eligibility` → `{ allowed: boolean, country: string | null, attested: boolean, reason?: TradeDenialCode }`
  - `POST /api/trade/attest` → `{ ok: true }` + `Set-Cookie`, or 403 if geo denied

- [ ] **Step 1: Create eligibility route**

```typescript
// app/api/trade/eligibility/route.ts
import { NextResponse } from "next/server";

import {
  evaluateGeoAccess,
  getRequestCountry,
  hasTradeAttestation,
} from "@/lib/trade/eligibility";

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
```

- [ ] **Step 2: Create attest route**

```typescript
// app/api/trade/attest/route.ts
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

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  response.headers.append("Set-Cookie", createAttestationCookieHeader());
  return response;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/trade/eligibility/route.ts app/api/trade/attest/route.ts
git commit -m "Add trade eligibility status and attestation cookie routes."
```

---

### Task 3: Gate assets and quote APIs

**Files:**
- Modify: `app/api/trade/assets/route.ts` — call `assertTradeAccess` at start of `GET`
- Modify: `app/api/trade/quote/route.ts` — same, before `ZERO_EX_API_KEY` check (or immediately after; either order OK as long as geo/attest fails before upstream spend)

**Interfaces:**
- Consumes: `assertTradeAccess(request)`
- Produces: 403 JSON with `code` when denied; existing success paths unchanged

- [ ] **Step 1: Gate assets route**

At the top of `GET(request: Request)` in `app/api/trade/assets/route.ts`, after imports:

```typescript
import { assertTradeAccess } from "@/lib/trade/eligibility";
```

First lines inside `GET`:

```typescript
const denied = assertTradeAccess(request);
if (denied) return denied;
```

Ensure the handler signature is `export async function GET(request: Request)` (pass `request` through if it was previously unused — change from no-arg if needed).

- [ ] **Step 2: Gate quote route**

Same import + `assertTradeAccess` at the start of `GET` in `app/api/trade/quote/route.ts`.

- [ ] **Step 3: Smoke-check with curl against `pnpm dev` (dev = missing country allowed)**

With server running:

```bash
# No cookie → attestation_required
curl -s -o /tmp/trade-assets.json -w "%{http_code}" http://localhost:3000/api/trade/assets
cat /tmp/trade-assets.json
# Expect: 403, code attestation_required

# Simulate US block
curl -s -H "x-vercel-ip-country: US" http://localhost:3000/api/trade/eligibility
# Expect: allowed:false, reason:geo_blocked
```

- [ ] **Step 4: Commit**

```bash
git add app/api/trade/assets/route.ts app/api/trade/quote/route.ts
git commit -m "Enforce geo and attestation on trade assets and quote APIs."
```

---

### Task 4: Trade page eligibility UI gate

**Files:**
- Create: `components/trade/TradeEligibilityGate.tsx`
- Modify: `app/trade/page.tsx` — fetch eligibility; show gate or `TradeSwapPanel`
- Modify: `app/trade/page.tsx` aria-label `Return to Creative Bank home` → `Return to Creative Finance home` (branding overlap OK here)

**Interfaces:**
- Consumes: `GET /api/trade/eligibility`, `POST /api/trade/attest`
- Produces: `TradeEligibilityGate` props `{ onAttested: () => void }` or self-contained fetch that calls `children` / callback when ready

- [ ] **Step 1: Create `TradeEligibilityGate`**

Client component that:

1. On mount `fetch("/api/trade/eligibility")` → state `{ allowed, attested, country, reason, loading, error }`
2. If loading → centered “Checking eligibility…”
3. If `!allowed` → message that Trade is not available in their region; `Link` to `/`; no swap
4. If `allowed && !attested` → checkbox:

   > I confirm I am not a U.S. person and am not located in a restricted jurisdiction for Robinhood Stock Tokens.

   + Continue button → `POST /api/trade/attest` with `credentials: "include"` → on success call `onReady()`
5. If `allowed && attested` → call `onReady()` (or render `children`)

Use Tailwind patterns already on `/trade` (rounded borders, slate palette). Accessibility: checkbox `id` + `label htmlFor`, Continue `disabled` until checked, `aria-busy` while posting.

Skeleton:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type EligibilityResponse = {
  allowed: boolean;
  country: string | null;
  attested: boolean;
  reason?: string;
};

type Props = {
  onReady: () => void;
};

export const TradeEligibilityGate = ({ onReady }: Props) => {
  // implement per steps above
};
```

- [ ] **Step 2: Wire `app/trade/page.tsx`**

- Add `const [eligible, setEligible] = useState(false)`
- Replace unconditional `<TradeSwapPanel … />` with:

```tsx
{!eligible ? (
  <TradeEligibilityGate onReady={() => setEligible(true)} />
) : (
  <TradeSwapPanel walletAddress={walletAddress} />
)}
```

- Change aria-label home link to Creative Finance.

- [ ] **Step 3: Manual UI check**

Open `/trade` in browser: see attestation gate; after Continue, swap panel loads and assets fetch succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/trade/TradeEligibilityGate.tsx app/trade/page.tsx
git commit -m "Gate /trade behind region check and eligibility attestation."
```

---

### Task 5: Activate homepage Trade CTA

**Files:**
- Modify: `components/NewProducts.tsx`

- [ ] **Step 1: Update Trade product entry**

```typescript
{
  title: "Trade",
  description: "Trade tokenized stocks on Robinhood Chain",
  image: "/globe.svg",
  ctaLabel: "Go to Trading",
  ctaHref: "/trade",
  fullWidth: true,
},
```

- [ ] **Step 2: Commit**

```bash
git add components/NewProducts.tsx
git commit -m "Activate homepage Trade CTA to /trade."
```

---

### Task 6: Creative Finance user-facing rename

**Files:**
- Modify: `app/manifest.ts`
- Modify: `lib/wagmiConfig.ts` (WalletConnect metadata ~188–189)
- Modify: `app/terms/page.tsx` (~84)
- Modify: `app/strategies/page.tsx` (~161, ~312, ~328)
- Modify: `app/lending/page.tsx` (~483)
- Modify: `components/vaults/VaultDeployModal.tsx` (~233 comment, ~708 copy)

- [ ] **Step 1: Manifest / PWA**

```typescript
name: "Creative Finance",
short_name: "Creative Finance",
description:
  "Finance designed for creatives. Manage your income, track expenses, and save for your dreams.",
```

- [ ] **Step 2: WalletConnect metadata**

```typescript
name: "Creative Finance",
description: "Creative Finance DeFi access",
```

- [ ] **Step 3: Replace user-visible “Creative Bank” strings** in the listed files with “Creative Finance” (Treasury, DeFi Suite, members copy, aria-labels). Leave Solidity and deploy scripts untouched.

- [ ] **Step 4: Verify no remaining UI hits**

```bash
rg -n 'Creative Bank' app/manifest.ts lib/wagmiConfig.ts app/terms/page.tsx app/strategies/page.tsx app/lending/page.tsx app/trade/page.tsx components/vaults/VaultDeployModal.tsx components/NewProducts.tsx
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add app/manifest.ts lib/wagmiConfig.ts app/terms/page.tsx app/strategies/page.tsx app/lending/page.tsx components/vaults/VaultDeployModal.tsx
git commit -m "Rename user-facing Creative Bank labels to Creative Finance."
```

---

### Task 7: Env template + verification

**Files:**
- Modify: `.env.template`

- [ ] **Step 1: Document `TRADE_GEO_BYPASS`**

Near `ZERO_EX_API_KEY`:

```bash
# Trade eligibility — set to 1 only in local/staging to skip US geo deny. Never in production.
# TRADE_GEO_BYPASS=1
```

- [ ] **Step 2: Format + build**

```bash
pnpm format:check
pnpm build
```

Expected: Prettier clean (or run `pnpm format` then re-check); build succeeds (typecheck included).

- [ ] **Step 3: Commit**

```bash
git add .env.template
git commit -m "Document TRADE_GEO_BYPASS for local trade geo testing."
```

- [ ] **Step 4: Push branch**

```bash
git push -u origin HEAD
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Activate Trade CTA | Task 5 |
| Vercel geo + US block + prod fail-closed | Task 1 |
| Attestation cookie | Tasks 1–2 |
| Gate `/api/trade/assets` + `/quote` | Task 3 |
| `GET eligibility` + `POST attest` | Task 2 |
| `/trade` UI blocked / attest / swap | Task 4 |
| Soft disclaimer remains in swap panel | Task 4 (leave existing aside) |
| Creative Finance manifest / WC / UI | Task 6 |
| `TRADE_GEO_BYPASS` in `.env.template` | Task 7 |
| Solidity untouched | Task 6 constraint |

## Self-review notes

- No placeholders; cookie name `trade_attest` consistent across tasks.
- Repo has no unit-test runner — verification uses `tsx` + `curl` + `pnpm build`.
- `assets` GET currently may not take `request` — Task 3 must add the parameter.
