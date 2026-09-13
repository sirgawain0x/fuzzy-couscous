# Creative Bank Configuration Guide

## Critical Configuration for Membership Detection

The Creative membership NFTs (Creative Brand, Creative Investor, Creative Creator) are deployed on **Base Mainnet (Chain ID: 8453)**. Your environment configuration must match this network to detect memberships correctly.

## Required Environment Variables

### Network Configuration (CRITICAL)

```bash
# MUST be set to "base" or "base-mainnet" for production
NEXT_PUBLIC_CHAIN_ID=base

# MUST be 8453 for Base Mainnet memberships
NEXT_PUBLIC_UNLOCK_CHAIN_ID=8453

# Unlock Protocol Contract Address on Base Mainnet
NEXT_PUBLIC_UNLOCK_ADDRESS=0xd0b14797b9D08493392865647384974470202A78

# RPC Provider URL for Unlock Protocol
NEXT_PUBLIC_UNLOCK_PROVIDER_URL=https://rpc.unlock-protocol.com/8453

# Unlock Protocol Client ID
NEXT_PUBLIC_UNLOCK_CLIENT_ID=creative-bank
```

### RPC Configuration (Recommended to Avoid Rate Limits)

```bash
# Alchemy API Key (RECOMMENDED - provides higher rate limits)
# Get a free API key at: https://www.alchemy.com/
# Without this, you'll use public RPCs which are rate-limited
ALCHEMY_API_KEY=your_alchemy_api_key

# Custom RPC URLs (optional - overrides default public RPCs)
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

**Important:** The app now uses multiple fallback RPC endpoints:

1. Alchemy (if API key provided) - Highest priority
2. Custom RPC URL (if provided)
3. Default Base public RPC
4. Additional public fallbacks (Tenderly, PublicNode, 1RPC, MeowRPC)

This prevents 403 errors from rate limiting.

### WalletConnect (Optional)

```bash
# Get yours at: https://cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### Creative Bank Yearn Vault & Bouncer (Production)

Use the vault that has the bouncer wired via `set_deposit_limit_module(bouncer)` so the UI and on-chain gating match:

```bash
# Vault address (the one with deposit_limit_module set to the bouncer)
NEXT_PUBLIC_CREATIVE_BANK_YEARN_VAULT_ADDRESS=0x52fb76742fb6FEF1924A523c040669a5b5b3e18f

# Bouncer address (Creative Bank deposit limit module)
# Deploy with: forge script script/DeployCreativeBankBouncer.s.sol --rpc-url base --broadcast
# Wire to vault with: forge script script/WireYearnVaultBouncer.s.sol:WireYearnVaultBouncer --rpc-url base --broadcast
NEXT_PUBLIC_CREATIVE_BANK_BOUNCER_ADDRESS=0x70f00d2e6037f5ae1A1D8A2910e99aadB80232bc
```

If `NEXT_PUBLIC_CREATIVE_BANK_YEARN_VAULT_ADDRESS` is not set, the app falls back to the legacy Kalani vault address. See `docs/KALANI_GOAT_INTEGRATION.md` for full setup.

## Membership Lock Contracts

The following Unlock Protocol locks are deployed on **Base Mainnet (8453)**:

| Tier              | Contract Address                             | Priority    |
| ----------------- | -------------------------------------------- | ----------- |
| Creative Brand    | `0x9c3744c96200a52d05a630d4aec0db707d7509be` | 3 (Highest) |
| Creative Investor | `0x13b818daf7016b302383737ba60c3a39fef231cf` | 2           |
| Creative Creator  | `0xf7c4cd399395d80f9d61fde833849106775269c6` | 1           |

## Troubleshooting Membership Detection

If memberships are not being recognized, check the following:

### 1. Network Configuration

**Problem:** Most common issue - network mismatch
**Solution:** Ensure `NEXT_PUBLIC_UNLOCK_CHAIN_ID=8453` and `NEXT_PUBLIC_CHAIN_ID=base`

Without these settings, the app will query the wrong network (Base Sepolia by default in dev mode) where the membership contracts don't exist.

### 2. Check Browser Console

Look for these log sections:

#### Network Configuration Check

```
[unlockMemberships] Network Configuration Check:
  unlockChainId: 8453
  expectedChainId: 8453
  isBaseMainnet: true
  warning: "✓ Network configuration correct"
```

If you see a warning here, your network is misconfigured.

#### Active Address Detection

```
[MembershipContext] ✓ Using Crossmint wallet address: 0x...
```

Verify this is the correct address that holds the membership NFT.

#### Membership Status

```
[unlockMemberships] ✓ Creative Creator status:
  hasValidKey: true
  expiresAtMs: 1234567890000
  expiresAt: "2025-12-31T23:59:59.000Z"
```

If `hasValidKey` is `false`, the NFT was not found at that address on that network.

### 3. Verify NFT Ownership

Check on BaseScan that your wallet actually holds the membership NFT:

- **Creative Brand:** https://basescan.org/token/0x9c3744c96200a52d05a630d4aec0db707d7509be
- **Creative Investor:** https://basescan.org/token/0x13b818daf7016b302383737ba60c3a39fef231cf
- **Creative Creator:** https://basescan.org/token/0xf7c4cd399395d80f9d61fde833849106775269c6

Enter your wallet address in the search box to see if you hold a key.

### 4. Check Membership Expiration

Unlock Protocol memberships can expire. Check the `expiresAt` timestamp in the console logs:

```javascript
expiresAt: "2025-12-31T23:59:59.000Z"; // Future date = valid
expiresAt: "2023-01-01T00:00:00.000Z"; // Past date = expired
```

### 5. Use the Debug Panel

In development mode, a debug panel appears in the bottom-right corner of the `/strategies` page showing:

- Current network configuration
- Active wallet address
- Membership status for all tiers
- Any errors encountered

## Common Issues and Solutions

### Issue: "Network mismatch detected"

```
[unlockMemberships] ❌ CRITICAL: Network mismatch detected!
Unlock Protocol is configured for chain: 84531
Membership locks are deployed on Base Mainnet (8453)
```

**Solution:** Add to your `.env.local`:

```bash
NEXT_PUBLIC_UNLOCK_CHAIN_ID=8453
NEXT_PUBLIC_CHAIN_ID=base
```

### Issue: "No active address detected"

```
[MembershipContext] ✗ No active address detected
```

**Solution:** Ensure wallet is connected. Check that Crossmint authentication is working or browser wallet is connected.

### Issue: "Failed to fetch membership"

```
[unlockMemberships] ✗ Failed to fetch Creative Creator membership
```

**Solution:**

- Check network connectivity
- Verify RPC endpoint is accessible
- Check for API rate limiting
- Verify the lock contract address is correct

### Issue: Wrong wallet address being checked

If the Crossmint wallet address doesn't match your expected address:

**Solution:** The app prioritizes Crossmint wallet over browser wallet. Make sure you're logged in to the correct Crossmint account that holds the membership.

## Development vs Production

### Development Mode

- Debug panel is visible
- Extensive console logging
- Defaults to Base Sepolia unless configured otherwise

### Production Mode

- Debug panel hidden
- Less verbose logging
- Defaults to Base Mainnet

**Important:** Always explicitly set `NEXT_PUBLIC_CHAIN_ID=base` and `NEXT_PUBLIC_UNLOCK_CHAIN_ID=8453` to avoid network issues.

## Testing Your Configuration

1. Set environment variables in `.env.local`
2. Restart your development server
3. Open `/strategies` page
4. Open browser console
5. Look for the configuration check logs
6. Verify the debug panel shows correct network
7. Check that your membership status is detected

## Rate Limiting Issues

If you're seeing 403 errors from Alchemy or other RPC providers:

### Problem: RPC Rate Limiting

```
base-mainnet.g.alchemy.com/v2/xxx: Failed to load resource: 403
```

### Solutions:

1. **Get an Alchemy API Key (Recommended)**
   - Sign up at https://www.alchemy.com/ (free tier available)
   - Create apps for the networks you use (Base + Ethereum mainnet if needed)
   - Copy your API key
   - Add to `.env.local` as a **server-only** env var:
     ```bash
     ALCHEMY_API_KEY=your_alchemy_api_key_here
     ```
   - The app proxies JSON-RPC through same-origin routes (e.g. `/api/rpc/mainnet`) so the browser does **not** call Alchemy directly.

2. **Automatic Fallback**
   - The app now automatically falls back to multiple public RPC endpoints
   - If one fails, it tries the next one
   - Includes: Base official, Tenderly, PublicNode, 1RPC, MeowRPC

3. **Batching & Retry Logic**
   - Requests are automatically batched (50ms wait)
   - Failed requests retry 2-3 times with 1s delay
   - Reduces total API calls

### Verification

After adding your Alchemy key, you should see in the console:

```
[wagmiConfig] Configured 5 RPC endpoints for Base Mainnet
```

This means you have Alchemy + 4 fallback endpoints.

## Need Help?

If you're still experiencing issues after following this guide:

1. Copy the full console output (all `[MembershipContext]` and `[unlockMemberships]` logs)
2. Take a screenshot of the debug panel
3. Verify your wallet address on BaseScan
4. Check that you're using the correct wallet/account
5. Check for RPC 403 errors and consider adding an Alchemy API key
