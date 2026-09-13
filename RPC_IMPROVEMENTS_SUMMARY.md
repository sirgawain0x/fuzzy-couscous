# RPC Configuration Improvements Summary

## Problem

You were experiencing 403 errors from Alchemy RPC endpoints:

```
base-mainnet.g.alchemy.com/v2/xxx: Failed to load resource: 403
```

This indicates rate limiting from using a shared/public Alchemy API key or hitting request limits.

## Solution Implemented

### 1. Multiple RPC Fallbacks

Your app now uses **multiple RPC endpoints with automatic fallback**:

**Priority Order:**

1. **Alchemy (if you provide your own API key)** - Highest priority, best performance
2. **Custom RPC URL** - If you specify `NEXT_PUBLIC_BASE_RPC_URL`
3. **Base Official RPC** - `https://mainnet.base.org` (default)
4. **Public Fallbacks** - 2 random selections from:
   - Tenderly Gateway
   - PublicNode
   - 1RPC
   - MeowRPC

**How it works:** If one endpoint fails or is rate-limited, wagmi automatically tries the next one.

### 2. Smart Rate Limit Handling

Each RPC endpoint now has:

- **Request batching** - Combines multiple requests (50-100ms wait)
- **Retry logic** - Automatically retries failed requests 1-3 times
- **Exponential backoff** - Waits 1 second between retries
- **Speed ranking** - Wagmi learns which endpoints are fastest and prioritizes them

### 3. Configuration Options

Add to your `.env.local` file:

```bash
# RECOMMENDED: Get your own free Alchemy API key
ALCHEMY_API_KEY=your_alchemy_api_key

# Optional: Use a different primary RPC
NEXT_PUBLIC_BASE_RPC_URL=https://your-rpc-provider.com
```

## Benefits

### Without Alchemy API Key (Current State)

- ✓ Uses 3-5 free public RPC endpoints
- ✓ Automatic fallback if one fails
- ✓ Request batching reduces total calls
- ⚠️ May still hit rate limits during heavy usage
- ⚠️ Slower than dedicated API

### With Alchemy API Key (Recommended)

- ✓ Higher rate limits (100K compute units/day on free tier)
- ✓ Better performance and reliability
- ✓ Still has fallbacks if Alchemy has issues
- ✓ Priority access to Base network
- ✓ Ideal for production use

## Getting an Alchemy API Key

1. **Sign up** at https://www.alchemy.com/ (free tier available)
2. **Create App:**
   - Chain: Base Mainnet
   - Network: Base
3. **Copy API Key** from the app dashboard
4. **Add to `.env.local`:**
   ```bash
   ALCHEMY_API_KEY=your_key_here
   ```
5. **Restart dev server:** `pnpm dev`

## Verification

After implementing changes, check console on app load:

```
[wagmiConfig] Configured 5 RPC endpoints for Base Mainnet
```

This means you have multiple endpoints configured!

## Why This Matters

1. **Prevents 403 Errors** - Multiple endpoints = no single point of failure
2. **Better UX** - Faster, more reliable blockchain queries
3. **Production Ready** - Handles rate limits gracefully
4. **Cost Effective** - Free tier is sufficient for most apps
5. **Scalable** - Easy to add more endpoints as needed

## Technical Details

### Before (Single Endpoint)

```typescript
transports: {
  [base.id]: fallback([
    http("https://mainnet.base.org")
  ])
}
```

### After (Multi-Endpoint with Ranking)

```typescript
transports: {
  [base.id]: fallback([
    http(`alchemy...${API_KEY}`, { batch, retry: 3 }),
    http("custom-rpc", { batch, retry: 2 }),
    http("mainnet.base.org", { batch, retry: 2 }),
    http("random-public-1", { batch, retry: 1 }),
    http("random-public-2", { batch, retry: 1 }),
  ], { rank: true })
}
```

## Files Modified

1. **`lib/wagmiConfig.ts`** - Enhanced RPC configuration
2. **`CONFIGURATION.md`** - Added RPC setup documentation

## No Breaking Changes

- ✓ Backward compatible - works without any env variables
- ✓ Opt-in improvements - add API key when ready
- ✓ Same API - no code changes needed elsewhere

## Next Steps

1. **Optional but Recommended:** Get an Alchemy API key
2. **Test:** Restart your app and verify multiple endpoints are configured
3. **Monitor:** Check console for RPC-related errors (should be fewer/none)

---

**Questions?** Check CONFIGURATION.md for detailed troubleshooting steps.
