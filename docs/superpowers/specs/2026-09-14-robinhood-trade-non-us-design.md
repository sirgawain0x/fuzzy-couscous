# Activate Robinhood Trade (non-US) + Creative Finance branding

**Date:** 2026-09-14  
**Branch:** `feature/robinhood-trade-homepage`  
**Status:** Awaiting user review of this spec

## Goal

Ship live Robinhood Chain stock-token trading (USDG ↔ Stock Tokens via 0x RFQ) to **non-U.S. users**, with server-enforced eligibility on trade APIs. Rename **user-facing** product strings from Creative Bank → **Creative Finance** (including PWA install name). Defer U.S. access (Dinari) until later.

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Product | Activate Trade (not Coming Soon) |
| Network | Robinhood Chain mainnet `4663` |
| Pairs | USDG ↔ Stock Tokens (existing scaffolding) |
| Eligibility | IP country + attestation; **server-enforced** on `/api/trade/*` |
| Geo source | **Vercel `x-vercel-ip-country`** |
| Blocked country (v1) | `US` |
| Branding | User-facing display names only; leave Solidity / vault deploy names alone |

## Out of scope

- Dinari / U.S.-person trading
- Perfect VPN resistance
- Renaming `CreativeBankBouncer`, strategy contract names, or deployed vault metadata
- Broad docs purge (`README` / `CLAUDE.md` optional follow-up; not required for PWA)

---

## 1. Activate Trade surface

### Homepage

- `components/NewProducts.tsx`: Trade row becomes live CTA  
  - `ctaLabel: "Go to Trading"`  
  - `ctaHref: "/trade"`  
  - Keep `fullWidth: true`  
  - Description may note tokenized equities / Robinhood Chain

### Existing scaffolding (keep / harden)

- `/trade` page + `TradeSwapPanel`
- `/api/trade/assets`, `/api/trade/quote`
- Robinhood chain in wagmi / Privy / `/api/rpc/robinhood`
- Require `ZERO_EX_API_KEY` in server env (already documented in `.env.template`)

---

## 2. Eligibility architecture

### 2.1 Country resolution

```
country = request.headers.get("x-vercel-ip-country")?.toUpperCase()
```

- **Production:** if `country === "US"` → deny. If header missing in production → **deny** (fail closed).
- **Non-production:** if header missing → **allow** (local `pnpm dev`), unless `TRADE_GEO_BYPASS=0` forces fail-closed.
- Optional override: `TRADE_GEO_BYPASS=1` allows all countries (local/staging only; must not be set in prod).

v1 deny list is only `US`. Attestation text still covers “U.S. persons” and “restricted jurisdictions” for legal soft coverage beyond IP.

### 2.2 Attestation

User must check a clear statement before trading, e.g.:

> I confirm I am not a U.S. person and am not located in a restricted jurisdiction for Robinhood Stock Tokens.

**Persistence (recommended):**

1. Client calls `POST /api/trade/attest` after checkbox + continue.
2. Server sets **httpOnly** cookie `trade_attest=1` with:
   - `Secure`, `SameSite=Lax`
   - Max-Age ~ 30 days (or session-only if preferred later)
3. Client may also keep a UI flag in `sessionStorage` for instant unlock after attest; **server cookie is authoritative**.

Do **not** trust a client-only header without the cookie (or a signed token). Prefer cookie so browsers send it automatically on `/api/trade/*`.

### 2.3 New / updated API routes

| Route | Behavior |
| --- | --- |
| `GET /api/trade/eligibility` | Returns `{ allowed, country, attested, reason? }` — no attestation required to *read* status |
| `POST /api/trade/attest` | Requires geo allowed; sets attestation cookie; returns `{ ok: true }` |
| `GET /api/trade/assets` | Requires geo allowed **and** attestation cookie |
| `GET /api/trade/quote` | Requires geo allowed **and** attestation cookie |

Shared helper: `lib/trade/eligibility.ts` (or similar):

- `getRequestCountry(request)`
- `assertTradeAccess(request)` → `NextResponse` 403 JSON on failure, else `null`
- Reasons: `geo_blocked`, `geo_unknown`, `attestation_required`

Error shape:

```json
{ "error": "Trade not available in your region", "code": "geo_blocked", "country": "US" }
```

```json
{ "error": "Eligibility attestation required", "code": "attestation_required" }
```

### 2.4 UI flow (`/trade`)

1. On load, call `/api/trade/eligibility`.
2. If `!allowed` → region blocked screen (no asset list, no swap controls). Link home.
3. If `allowed && !attested` → show attestation gate (checkbox + Continue). Swap panel disabled until success.
4. If `allowed && attested` → existing `TradeSwapPanel` (assets/quotes work).
5. Keep soft eligibility notice + RHJ docs link inside the swap panel.

### 2.5 Homepage visibility

- Trade CTA remains visible globally (discoverability).
- Enforcement happens on `/trade` + APIs (US users who click see the blocked screen).

---

## 3. Creative Finance branding (user-facing)

| Location | Change |
| --- | --- |
| `app/manifest.ts` | `name` / `short_name` → `Creative Finance`; update description if it still says “Banking…” |
| `lib/wagmiConfig.ts` | WalletConnect `name` / `description` → Creative Finance |
| `app/trade/page.tsx`, `app/strategies/page.tsx`, `app/lending/page.tsx` | aria-labels / suite titles referencing Creative Bank → Creative Finance |
| `app/strategies/page.tsx` | Member vault marketing copy |
| `app/terms/page.tsx` | “Creative Bank Treasury” → “Creative Finance Treasury” |
| `components/vaults/VaultDeployModal.tsx` | User-visible treasury copy (and matching comment if adjacent) |

**Leave alone:** Solidity (`CreativeBankBouncer`), forge scripts, on-chain vault/strategy names, package name `creative-bank-app` (optional later), internal API comments that name the Yearn product card unless user-visible.

**PWA note:** Users who already installed “Creative Bank” may need to remove and re-add the PWA for the new install name to appear.

---

## 4. Env / ops

| Variable | Purpose |
| --- | --- |
| `ZERO_EX_API_KEY` | Required for quotes (existing) |
| `ALCHEMY_API_KEY` | Robinhood RPC via `/api/rpc/robinhood` (existing) |
| `TRADE_GEO_BYPASS` | `1` = skip geo deny (dev/staging only) |

Document `TRADE_GEO_BYPASS` in `.env.template`.

---

## 5. Testing

- [ ] Homepage Trade CTA navigates to `/trade`
- [ ] With mocked `x-vercel-ip-country: US`, eligibility `allowed=false`; assets/quote return 403 `geo_blocked`
- [ ] Non-US (or missing header in dev): attestation required before assets/quote succeed
- [ ] After attest, cookie present; assets + indicative price + firm quote path work when `ZERO_EX_API_KEY` set
- [ ] PWA manifest serves `Creative Finance` at `/manifest.webmanifest` (or Next manifest route)
- [ ] WalletConnect / UI strings no longer show “Creative Bank” in listed user-facing spots
- [ ] `pnpm format:check` / `pnpm build` (typecheck)

---

## 6. Risks / caveats

- IP geo is bypassable via VPN; attestation is self-declared — this is **best-effort**, not KYC.
- Missing geo header in production fails closed (may block some edge clients); monitor 403 `geo_unknown`.
- Legal copy should stay aligned with RHJ issuer disclosures; link remains in UI.

## Approval

- [ ] User approved this spec — proceed to implementation plan
