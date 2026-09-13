# Creative Finance (bank)

## Architecture

Creative Bank is a fintech-grade DeFi platform on Base. The architecture separates three concerns:

### Identity & Wallet (Crossmint)

- Crossmint Auth handles login (Email OTP, Google OAuth) via `CrossmintAuthProvider` + `EmbeddedAuthForm`
- Wallets are created on login (`createOnLogin` with passkey + email recovery)
- Optional server session routes: `/api/auth/crossmint/refresh`, `/api/auth/crossmint/logout` (`@crossmint/server-sdk`)
- Server APIs validate Crossmint JWTs via JWKS (`lib/crossmintAuth.ts`)
- Phone verification for Coinbase warm-start is stored in CockroachDB (`phone_number_verified_at`)
- Wallet transfer webhooks sync the ledger (`lib/crossmint-webhook.ts`); see `docs/CROSSMINT_WEBHOOKS.md`
- Wallet address is the stable user identifier across all systems

### Membership Layer (Unlock Protocol)

- Source of truth for membership tiers via NFT keys on Base Mainnet
- Three locks: Creative ($30/3mo), Investor ($100/mo), Brand ($1000/mo)
- MembershipContext checks `getHasValidKey(address)` on each lock
- Bouncer contract enforces 10% fee floor on-chain

### Database (CockroachDB Serverless)

- GCP us-east1 (South Carolina) for cloud diversity
- PostgreSQL driver (`pg`) — same pattern as Creative TV's Supabase
- `users` table: `crossmint_user_id` (PK) → `wallet_address` (unique)
- `transactions` table: keyed by `wallet_address`, `crossmint_user_id` for correlation

### Coinbase Onramp

- Headless v2 API for Express Checkout (Apple Pay / Google Pay — embedded)
- Popup v1 fallback for All Payment Methods (card, ACH, etc.)
- `wallet_address` used as `partnerUserRef` for transaction continuity

### Fee Model (Vault Factory)

- Non-Member: 20% performance fee (hardcoded, read-only)
- Member: 10% floor (editable, "up" only)
- Distribution: `Net_Manager = (F × 0.5) × 0.9` (Aave gets 50%, Yearn gets 10% of manager share)
- Brand/Creator members: Fee Receiver Address field exposed
- Non-member: fees go to Creative Bank Treasury

## Roadmap

### Completed

- **Phase 1**: Stytch BYOA Auth + Crossmint Wallet Separation
- **Phase 2**: Coinbase Headless Onramp (v2 API) + Card Fallback
- **Phase 3**: CockroachDB Serverless Ledger (GCP us-east1)
- **Phase 3b**: Vault Fee Tiers (20% non-member / 10% member floor, Aave/Yearn/Manager split)
- **Phase 3c**: Membership Onboarding (Unlock Protocol paywall, PremiumGuard fix)

### Completed (continued)

- **Phase 4**: Financial Reporting & Tax Export — Earnings tracking from CockroachDB, CSV/PDF export
- **Phase 5**: Risk Management — Nexus Mutual covered vaults, Symbiotic underwriting for Brand/Investor
- **Phase 6**: Liquidity Optimization — Aave E-Mode for Investor tier, Isolation Mode controls
- **Phase 7**: Operational Awareness — Crossmint webhooks, Goldsky pipeline, Health Factor monitoring & alerts
- **Phase 8**: Infrastructure Hardening — Bouncer v2 with on-chain 10% fee floor enforcement

## Git Workflow

- Default branch: `prod`
- **Always fetch and pull before branching:**
 ```bash
 git fetch origin
 git checkout prod
 git pull origin prod
 ```
- **Create feature branches from up-to-date `prod`:**
 ```bash
 git checkout -b feature/<description> prod
 ```
- **Branch naming:** `feature/*`, `fix/*`, `chore/*`
- **Rebase before pushing:**
 ```bash
 git fetch origin
 git rebase origin/prod
 ```
- **Never commit directly to `prod`** — always use feature branches + PRs
