# Tableland Integration Setup Guide

## Overview

Transaction history is now persisted in Tableland, a decentralized SQL database. This provides:

- ✅ Fast cached reads from on-chain storage
- ✅ Automatic background sync with Coinbase API
- ✅ Decentralized, transparent transaction history
- ✅ No single point of failure

## Files Created/Modified

1. **`lib/tableland.ts`** - Tableland client setup with your Project ID and Environment ID
2. **`server-actions/getTransactions.ts`** - Updated to cache in Tableland and sync in background
3. **`server-actions/initTableland.ts`** - Server action to initialize the transactions table
4. **`app/api/init-tableland/route.ts`** - API endpoint to create the table (one-time setup)

## Setup Steps

### 1. Add Environment Variables

Add to your `.env.local`:

```bash
# Tableland Configuration
TABLELAND_PRIVATE_KEY=your_private_key_here  # Required for server-side writes
TABLELAND_TABLE_NAME=transactions  # Will be set after table creation
```

**Important:** The `TABLELAND_PRIVATE_KEY` should be a private key from a wallet that will be used for server-side database writes. This wallet will need some ETH on Base for gas fees.

### 2. Initialize the Table (One-Time)

Once you've set `TABLELAND_PRIVATE_KEY`, make a POST request to initialize the table:

```bash
# Using curl
curl -X POST http://localhost:3000/api/init-tableland

# Or using your browser/Postman
# POST http://localhost:3000/api/init-tableland
```

The response will include the table name. Update your `.env.local`:

```bash
TABLELAND_TABLE_NAME=<returned_table_name>
```

### 3. Verify Setup

After initialization:

1. The table will be created on Tableland
2. Transaction fetching will automatically cache results
3. Background sync keeps data fresh

## How It Works

1. **First Request**:
   - Checks Tableland for cached transactions
   - If found, returns immediately (fast!)
   - Triggers background sync with Coinbase API

2. **Background Sync**:
   - Fetches latest from Coinbase API
   - Updates Tableland with new/updated transactions
   - Doesn't block the user response

3. **Subsequent Requests**:
   - Returns cached data from Tableland
   - Continues background sync to keep data fresh

## Table Schema

The transactions table includes:

- `user_id` - Crossmint user ID
- `transaction_id` - Unique Coinbase transaction ID
- `status` - Transaction status
- `to_address`, `from_address` - Wallet addresses
- `sell_amount_value`, `sell_amount_currency` - Amount being sold
- `buy_amount_value`, `buy_amount_currency` - Amount being bought
- `onchain_hash` - On-chain transaction hash (if available)
- `created_at`, `updated_at` - Timestamps
- `raw_data` - Full transaction JSON for complete data

## Troubleshooting

### "No Tableland signer available"

- Make sure `TABLELAND_PRIVATE_KEY` is set in `.env.local`
- The private key should start with `0x`

### Table creation fails

- Ensure the wallet has ETH on Base for gas fees
- Check that Project ID and Environment ID are correct in `lib/tableland.ts`

### Transactions not caching

- Verify `TABLELAND_TABLE_NAME` matches the created table name
- Check server logs for Tableland errors
- The system will fallback to Coinbase API if Tableland fails

### Background sync not working

- This is non-blocking - errors are logged but don't affect user experience
- Check server logs for sync errors
- Manual sync happens on next `getTransactions` call

## Benefits

1. **Performance**: Cached reads are much faster than API calls
2. **Reliability**: Works even if Coinbase API is temporarily down
3. **Transparency**: All data stored on-chain, verifiable
4. **Decentralization**: No single point of failure
5. **Cost**: Reads are free, writes cost minimal gas on Base

## Next Steps

1. Set `TABLELAND_PRIVATE_KEY` in `.env.local`
2. Initialize the table via `/api/init-tableland`
3. Update `TABLELAND_TABLE_NAME` with the returned table name
4. Test transaction fetching - it should now cache automatically!
