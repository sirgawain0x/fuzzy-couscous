# Withdrawal Functionality Troubleshooting

## ⚠️ IMPORTANT: Testnet Not Supported

**Coinbase Offramp ONLY works with MAINNET chains. You cannot withdraw from testnet addresses.**

If your wallet is on:

- ❌ `base-sepolia` (testnet)
- ❌ `sepolia` (testnet)
- ❌ `goerli` (testnet)
- ❌ `mumbai` (testnet)

You must **switch to mainnet** (e.g., `base`, `ethereum`, `polygon`) to use withdrawal functionality.

### How to Switch to Mainnet

**Option 1: Switch Network in Your Wallet**

1. Open your wallet (MetaMask, Coinbase Wallet, etc.)
2. Click the network dropdown
3. Select "Base Mainnet" (or another supported mainnet)

**Option 2: Configure Crossmint for Mainnet**
Update your Crossmint configuration to use mainnet chains.

---

## Current Issue: 401 Unauthorized Error

If you're seeing a 401 "Invalid Coinbase API credentials" error when attempting withdrawals, here are the steps to diagnose and fix the issue:

## 1. Verify API Key Configuration

### Check Your CDP API Keys

1. Go to [Coinbase Developer Platform Portal](https://portal.cdp.coinbase.com/)
2. Navigate to your project
3. Check the **API Keys** section

### Required API Key Permissions

Your CDP Secret API Key must have the following permissions enabled:

- ✅ **Onramp/Offramp** - Access to buy and sell APIs
- ✅ **Read** - Ability to read transaction data
- ✅ **Trade** - May be required for offramp operations

### Create a New API Key (if needed)

If your current API key doesn't have the right permissions:

1. Click **Create API Key** in the CDP Portal
2. Select **Secret API Key** (not Client API Key)
3. Enable the following scopes:
   - Onramp
   - Offramp
   - Any other relevant permissions
4. Download the key and update your `.env` file:
   ```bash
   COINBASE_API_KEY_ID=organizations/xxx/apiKeys/xxx
   COINBASE_API_KEY_SECRET=-----BEGIN EC PRIVATE KEY-----...
   ```

## 2. Verify Environment Variables

Check that your environment variables are properly set:

```bash
# .env.local (for development)
COINBASE_API_KEY_ID=organizations/xxx/apiKeys/xxx
COINBASE_API_KEY_SECRET=-----BEGIN EC PRIVATE KEY-----...
```

**Important Notes:**

- The `COINBASE_API_KEY_ID` should start with `organizations/`
- The `COINBASE_API_KEY_SECRET` should be the full private key including headers
- Make sure there are no extra spaces or line breaks
- Restart your development server after changing environment variables

## 3. Common Issues and Solutions

### Issue: "Invalid Coinbase API credentials"

**Causes:**

- API key doesn't have Offramp permissions
- API key is from wrong environment (sandbox vs production)
- API key secret is malformed or incomplete
- JWT is being signed with wrong request parameters

**Solutions:**

1. Create a new API key with Offramp permissions
2. Ensure you're using a production API key (not sandbox)
3. Copy the full API key secret including BEGIN/END markers
4. Verify the latest code changes have been applied

### Issue: "No transactions found"

**Causes:**

- User hasn't initiated any withdrawal yet
- Wrong `partnerUserId` being used
- Transactions are in a different environment

**Solutions:**

1. Initiate a withdrawal first through the UI
2. Ensure the user ID matches the one passed to Coinbase
3. Check that you're using the same API keys for both creating and fetching transactions

## 4. Withdrawal Flow Checklist

✅ **Step 1:** Coinbase API keys are configured
✅ **Step 2:** Environment variables are set correctly
✅ **Step 3:** Session token creation works
✅ **Step 4:** User clicks "Withdraw" button
✅ **Step 5:** Redirected to Coinbase Offramp widget
✅ **Step 6:** Complete withdrawal on Coinbase
✅ **Step 7:** Transaction appears in Coinbase API
✅ **Step 8:** `useProcessWithdrawal` hook picks up pending transaction
✅ **Step 9:** Wallet sends funds to Coinbase address

## 5. Debug Logging

Check your Next.js console for these log messages:

```
Fetching transactions for user: {userId}
Request details: { method: 'GET', url: 'https://...', requestPath: '...' }
Generating JWT with CDP SDK...
JWT generated successfully with CDP SDK
JWT generated, making request...
```

If you see "Failed to fetch transactions" with status 401, the API key permissions are likely the issue.

## 6. API Key Scopes Reference

When creating your CDP API Key, ensure these scopes are enabled:

| Scope                      | Required | Purpose                   |
| -------------------------- | -------- | ------------------------- |
| `wallet:accounts:read`     | ❌       | Not needed for offramp    |
| `wallet:transactions:read` | ❌       | Not needed for offramp    |
| `onramp:read`              | ✅       | Read onramp data          |
| `onramp:write`             | ✅       | Create onramp sessions    |
| `offramp:read`             | ✅       | Read offramp transactions |
| `offramp:write`            | ✅       | Create offramp sessions   |

## 7. Still Having Issues?

If you've checked all of the above and are still having issues:

1. **Check Coinbase Status:** Visit [Coinbase Status](https://status.coinbase.com/) to see if there are any API outages
2. **Review API Docs:** Check the [Coinbase Offramp Documentation](https://docs.cdp.coinbase.com/onramp/docs/offramp)
3. **Contact Support:** Reach out in the [CDP Discord](https://discord.com/invite/cdp) #onramp channel
4. **Verify Account:** Ensure your Coinbase account has offramp enabled in your region

## 8. Next Steps

Once the 401 error is resolved:

1. The withdrawal button should successfully redirect to Coinbase
2. Complete a test withdrawal
3. Check that the pending transaction is picked up by `useProcessWithdrawal`
4. Verify the wallet sends the transaction

---

**Last Updated:** Based on changes made to fix JWT generation with correct request parameters.
