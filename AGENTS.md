# Agents

## Cursor Cloud specific instructions

### Overview

Creative Bank is a Next.js 16 (App Router + Turbopack) DeFi fintech app on Base. See `CLAUDE.md` for full architecture details.

### Running the dev server

```bash
pnpm dev
```

Starts Next.js with Turbopack on port 3000. The app requires valid environment variables to fully render the UI — specifically `NEXT_PUBLIC_PRIVY_APP_ID` must be set (placeholder values cause a runtime error in `PrivyProvider`).

### Lint / Format

```bash
pnpm format:check   # Prettier check (no ESLint configured)
pnpm format         # Prettier auto-fix
```

There is no ESLint configuration in this project — Prettier is the only code quality tool.

### Build

```bash
pnpm build          # Next.js production build (uses webpack, not turbopack)
```

TypeScript type-checking runs as part of the build. A successful build confirms no type errors.

### Key caveats

- **nvm path**: Node.js is installed via nvm at `/home/ubuntu/.nvm`. The shell must source it before running any node/pnpm commands: `export NVM_DIR="/home/ubuntu/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`
- **pnpm version**: The repo uses `packageManager: "pnpm@10.32.1"`. The installed v10.33.0 is compatible.
- **No ESLint**: The project uses Prettier only — no `eslint` config or script exists.
- **Environment variables**: The app hard-requires `NEXT_PUBLIC_PRIVY_APP_ID` and server routes require `PRIVY_APP_SECRET`. Set `ALCHEMY_API_KEY` for RPC proxy and wallet activity feeds.
- **Chain config**: In development, set `NEXT_PUBLIC_CHAIN_ID=base-sepolia`. In production (`NODE_ENV=production`), the app forces Base mainnet regardless of env var.
- **Build vs Dev bundler**: `pnpm dev` uses Turbopack; `pnpm build` uses Webpack (note the `--webpack` flag in the build script).
- **`pnpm approve-builds` warning**: The `@reown/appkit` package has an ignored build script. This is cosmetic and does not affect functionality.
- **Privy auth**: Enable Email and Google login methods in the [Privy dashboard](https://dashboard.privy.io). Embedded wallets are created on login via `@privy-io/wagmi`.
- **`pnpm build` SSG caveat**: Static page generation (SSG) will fail if `NEXT_PUBLIC_PRIVY_APP_ID` is unset because `app/providers.tsx` throws at module evaluation. Use `pnpm dev` (Turbopack) for day-to-day development — it handles this gracefully with dynamic rendering.
- **No test runner**: There is no test framework (Jest, Vitest, etc.) configured. The `scripts/` directory contains utility TypeScript scripts (Tableland, Yearn queries), not tests. Validation is done via `pnpm format:check` and `pnpm build` (type-check).
- **Unauthenticated pages**: `/strategies` renders without login and shows live Aave reserve data (APY, TVL). Useful for verifying the app works without signing in.
