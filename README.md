<div align="center">
<img width="200" alt="Image" src="https://bafybeidv76nddgn4zv52rqul6hgmf35oztbe66ebfq7cxhaadwakf4o7s4.ipfs.w3s.link/Asset%201.svg" />
<br>
<br>
<h1>Creative Bank</h1>

<div align="center">
<a href="https://bank.creativeplatform.xyz/">App Link</a> | <a href="https://t.me/thecrtv">Join our Telegram</a> 
</div>

<br>
<br>
<img src="https://github.com/user-attachments/assets/9bd7085c-5a92-4590-ae22-f892e353efce" alt="Image" width="full">
</div>

## Table of contents

- [Introduction](#introduction)
- [Deploy](#deploy)
- [Setup](#setup)
- [DeFi Strategies](#defi-strategies)
- [Using another chain](#using-another-chain)
- [Using in production](#using-in-production)
  - [Enabling Withdrawals](#enabling-withdrawals)

## Introduction

Create your own Fintech app in minutes using **[Crossmint](https://crossmint.com)** wallets and onramp.

**Key features**

- Login with email or social media
- Automatically create non-custodial wallets for your users
- Top up with USDC using a credit or debit card
- Transfer USDC to another wallet or email address
- View your wallet activity
- Withdraw USDC to your bank account
- Support for Base mainnet (automatically enforced in production) and Base Sepolia testnet (development only)
- Passkey-based wallet security
- Leverage more than +200 onchain tools integrating [GOAT](https://github.com/goat-sdk/goat)

**DeFi Strategies** 🚀

- **Aave V3 Vault Deployment**: Deploy custom ERC-4626 vaults backed by Aave's Base USDC reserve
- **Yearn V3 Integration**: Full ERC-4626 compliant vault interactions with deposit/withdrawal flows
- **MaxLoss Protection**: Configurable slippage protection for safe withdrawals
- **Token-Gated Access**: Premium strategies unlocked with Unlock Protocol memberships
- **Multi-Strategy Support**: Deploy and manage multiple yield strategies

See the [Yearn V3 Integration Guide](./docs/YEARN_V3_INTEGRATION.md) and [Quick Start](./docs/QUICKSTART.md) for details.

**Coming soon**

- Currency conversion
- Issue a debit card linked to your wallet

Get in touch with us to get early access to these features!

Join our [Telegram community](https://t.me/crossmintdevs) to stay updated on the latest features and announcements.

## Deploy

Easily deploy the template to Vercel with the button below. You will need to set the required environment variables in the Vercel dashboard.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCrossmint%2Ffintech-starter-app&env=NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY,NEXT_PUBLIC_CHAIN_ID,NEXT_PUBLIC_USDC_MINT)

## Setup

1. Clone the repository and navigate to the project folder:

```bash
git clone https://github.com/crossmint/fintech-starter-app.git && cd fintech-starter-app
```

2. Install all dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

3. Set up the environment variables:

```bash
cp .env.template .env
```

4. Login to the <a href="https://staging.crossmint.com/console" target="_blank">Crossmint staging console</a> and get the client API key from the <a href="https://staging.crossmint.com/console/overview" target="_blank">overview page</a>:

```env
NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY=your_client_side_API_key
```

5. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## DeFi Strategies

This app includes a comprehensive DeFi strategies integration featuring:

### Yearn V3 Vaults

Deploy and interact with Yearn V3 vaults following the ERC-4626 standard:

```bash
# Query available Yearn V3 vaults on Base
pnpm yearn:query
```

**Features:**

- ✅ **ERC-4626 Compliant**: Standardized deposit/withdrawal functions
- ✅ **MaxLoss Protection**: Configurable slippage protection (default 1%)
- ✅ **Real-time Pricing**: Transparent on-chain share conversion
- ✅ **User Balance Tracking**: Live vault position monitoring
- ✅ **Transaction Management**: Full state tracking with Basescan links

**Quick Start:**

1. Run `pnpm yearn:query` to find available vaults
2. Copy vault address from output
3. Update `app/strategies/page.tsx` with vault address
4. Users can now deposit/withdraw directly from the UI

**Documentation:**

- [Quick Start Guide](./docs/QUICKSTART.md) - Get started in 3 steps
- [Integration Guide](./docs/YEARN_V3_INTEGRATION.md) - Complete technical reference
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - Production activation guide

### Aave V3 Vaults

Deploy custom ERC-4626 vaults backed by Aave's Base USDC reserve:

- Configure performance fees
- Set revenue sharing with partners
- Automated yield routing
- Transparent on-chain reporting

### Token-Gated Strategies

Premium strategies protected by Unlock Protocol NFT memberships:

- **Kalani Vault Automation**: Multi-strategy orchestration for Creative Bank members
- **Role-based Access**: Different tiers unlock different strategies
- **Membership Management**: Integrated NFT-based authentication

Visit `/strategies` in your app to see all available DeFi products.

## Using another chain

This application currently supports the following chains:

- **`base`** - Base mainnet (production)
- **`base-sepolia`** - Base Sepolia testnet (development/testing)

To switch between chains:

1. Update the chain environment variable in your `.env` file:

```env
# For testnet/development
NEXT_PUBLIC_CHAIN_ID=base-sepolia

# For production
NEXT_PUBLIC_CHAIN_ID=base
```

2. **Important**: Make sure to update the USDC contract address for the chain you're using:

```env
# For Base mainnet
NEXT_PUBLIC_USDC_MINT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# For Base Sepolia testnet
NEXT_PUBLIC_USDC_MINT=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

**Note**:

- In **production** (`NODE_ENV=production`), the app will **always use Base mainnet** regardless of the `NEXT_PUBLIC_CHAIN_ID` setting. This ensures mainnet-only operations in production.
- In **development**, if `NEXT_PUBLIC_CHAIN_ID` is not set or contains an invalid value, the app will default to `base-sepolia` for safety.

## Using in production

This starter app is designed for rapid prototyping and testing in a staging environment. To move to production you'll need to:

1. Login to the [Crossmint production console](https://www.crossmint.com/console) and [create a client side API key](https://www.crossmint.com/console/projects/apiKeys) with the following scopes: `users.create`, `users.read`, `wallets.read`, `wallets.create`, `wallets:transactions.create`, `wallets:transactions.sign`, `wallets:transactions.read`, `wallets:balance.read`, `wallets.fund`.
2. Set the production environment variables:
   ```env
   NODE_ENV=production
   NEXT_PUBLIC_CHAIN_ID=base
   NEXT_PUBLIC_USDC_MINT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   ```
   **Note**: The app automatically enforces Base mainnet when `NODE_ENV=production`, but setting `NEXT_PUBLIC_CHAIN_ID=base` is recommended for clarity.
3. Customize your email template for login and signup in the [Crossmint console](https://www.crossmint.com/console) under the Settings tab in the Branding section.
4. For using onramp in production reach out to us on [Telegram](https://t.me/fintechstarterapp).
5. Enable withdrawals by following the [Coinbase API configuration](#enabling-withdrawals) steps below.

### Enabling Withdrawals

Withdrawals are powered by [Coinbase](https://www.coinbase.com/en-es/developer-platform) and require proper API configuration. For enabling withdrawals you'll need to:

1. [Create a Coinbase developer account](https://www.coinbase.com/en-es/developer-platform)
2. Create a Server API Key with the following permissions:
   - `wallet:addresses:read`
   - `wallet:withdrawals:create`
   - `wallet:transactions:read`
3. Add the following environment variables to your `.env` file:
   ```
   COINBASE_API_KEY_ID=your_coinbase_api_key_id_here
   COINBASE_API_KEY_SECRET=your_coinbase_api_key_secret_here
   ```
4. In the [Onramp configuration](https://portal.cdp.coinbase.com/products/onramp) add your domain to the domain allowlist

### Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# Crossmint Configuration (Required)
NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY=your_crossmint_client_api_key_here

# Chain Configuration (Required)
# Supported values: base, base-sepolia
NEXT_PUBLIC_CHAIN_ID=base-sepolia
NEXT_PUBLIC_USDC_MINT=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Coinbase Onramp/Offramp Configuration (Required for Deposits and Withdrawals)
COINBASE_API_KEY_ID=your_coinbase_api_key_id_here
COINBASE_API_KEY_SECRET=your_coinbase_api_key_secret_here

# Crossmint Auth + Webhooks (server key for session routes; webhook secret in production)
CROSSMINT_SERVER_API_KEY=your_crossmint_server_api_key_here
CROSSMINT_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
```

Authentication uses **Crossmint Auth** (`CrossmintAuthProvider` + `EmbeddedAuthForm`). Configure webhooks in the Crossmint Console — see [docs/CROSSMINT_WEBHOOKS.md](./docs/CROSSMINT_WEBHOOKS.md).

**USDC Contract Addresses:**

- **Base Mainnet**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Base Sepolia Testnet**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
