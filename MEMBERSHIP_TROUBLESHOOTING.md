# Quick Membership Troubleshooting Guide

## Your Issue: Membership Not Detected

You have a Creative Creator membership in your wallet, but the app isn't recognizing it. Here's what's likely happening:

## Most Common Cause: Network Mismatch ⚠️

**The Problem:**

- Your membership NFT is on **Base Mainnet (Chain ID: 8453)**
- Your app might be querying **Base Sepolia** (or another network)
- Result: NFT can't be found on the wrong network

**The Quick Fix:**

Create a file named `.env.local` in your project root with:

```bash
NEXT_PUBLIC_CHAIN_ID=base
NEXT_PUBLIC_UNLOCK_CHAIN_ID=8453
```

Then restart your development server:

```bash
pnpm dev
```

## How to Verify It's Working

### 1. Check the Debug Panel

- Go to `/strategies` page
- Look at bottom-right corner
- You should see a debug panel showing:
  - ✓ Unlock Chain ID: **8453 ✓**
  - Your wallet address
  - Membership status

### 2. Check Browser Console

Open DevTools Console and look for:

```
[unlockMemberships] Network Configuration Check:
  unlockChainId: 8453
  isBaseMainnet: true
  warning: "✓ Network configuration correct"
```

If you see this, the network is correct ✓

### 3. Look for Your Membership

Console should show:

```
[unlockMemberships] ✓ Creative Creator status:
  hasValidKey: true
```

## Other Possible Causes

### Wrong Wallet Address

**Check:** Is the address shown in the debug panel the same one that holds your membership?

**Fix:**

- Make sure you're logged in to the correct Crossmint account
- Or connect the correct browser wallet

### Expired Membership

**Check:** Look at the expiration date in the debug panel

**Fix:** Renew your membership on Unlock Protocol

### Wrong Network on BaseScan

**Check:** Verify your membership NFT exists on Base Mainnet:

- Go to: https://basescan.org/token/0xf7c4cd399395d80f9d61fde833849106775269c6
- Enter your wallet address
- You should see your Creative Creator key

**Fix:** If it's not there, the NFT might be on a different network or different wallet

## Step-by-Step Debugging

1. **Set Environment Variables**

   ```bash
   # In .env.local
   NEXT_PUBLIC_CHAIN_ID=base
   NEXT_PUBLIC_UNLOCK_CHAIN_ID=8453
   ```

2. **Restart Server**

   ```bash
   pnpm dev
   ```

3. **Open Strategies Page**
   - Navigate to `http://localhost:3000/strategies`

4. **Open Browser Console**
   - Press F12 or Cmd+Option+I
   - Go to Console tab

5. **Look for Configuration Check**
   - Should see `[unlockMemberships]` logs
   - First log should show network config
   - Should say `isBaseMainnet: true`

6. **Check Debug Panel**
   - Bottom-right corner of page
   - Verify network shows 8453 with ✓
   - Verify your wallet address is correct
   - Check membership status

7. **Verify on BaseScan**
   - Go to the Creative Creator contract
   - Check if your address holds a key

## What I Added to Help You Debug

1. **Enhanced Console Logging**
   - Detailed logs with emojis (✓/✗) for easy scanning
   - Network configuration validation
   - Membership check results
   - Error details

2. **Debug Panel Component**
   - Visual display of configuration
   - Shows active wallet address
   - Real-time membership status
   - Network warnings

3. **Configuration Documentation**
   - CONFIGURATION.md - Full setup guide
   - This file - Quick troubleshooting

## Still Not Working?

Check console logs and share:

1. The network configuration check output
2. The active address being used
3. The membership check results
4. Screenshot of the debug panel

This will help identify the exact issue.
