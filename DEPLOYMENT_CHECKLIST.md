# Yearn V3 Deployment Checklist

This checklist will help you activate the Yearn V3 integration once vaults are deployed on Base.

## 📋 Pre-Deployment Verification

- [x] Yearn V3 configuration files created
- [x] ERC-4626 hooks implemented
- [x] Deposit/withdrawal flows tested
- [x] UI components built and styled
- [x] Documentation complete

## 🔍 Discovery Phase

### Step 1: Query the Yearn Registry

Run the registry query script to discover available vaults:

```bash
# Install tsx if not already installed
pnpm add -D tsx

# Run the query script
npx tsx scripts/queryYearnRegistry.ts
```

This will output:

- All endorsed USDC vaults on Base
- Vault addresses
- Vault types (multi-strategy vs single-strategy)
- Deployment timestamps

**Expected Output:**

```
Found 1 endorsed USDC vault(s):

📦 Vault 1:
   Address: 0x1234...5678
   Type: Multi-Strategy
   Release Version: 3
   Tag: USDC Vault
   Deployed: 11/10/2025
```

### Step 2: Verify Vault Contract

Once you have a vault address, verify it's legitimate:

1. **Check on Basescan:**
   - Navigate to: `https://basescan.org/address/[VAULT_ADDRESS]`
   - Verify contract is verified
   - Check it implements ERC-4626 interface

2. **Read Contract Data:**
   ```bash
   # In browser console or using cast
   cast call [VAULT_ADDRESS] "asset()(address)" --rpc-url https://mainnet.base.org
   # Should return USDC address: 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913
   ```

## 🚀 Activation Steps

### Step 3: Update Strategies Page

1. **Open:** `app/strategies/page.tsx`

2. **Locate the commented YearnVaultCard** (around line 246)

3. **Uncomment and update:**

```typescript
<YearnVaultCard
  vaultAddress="0x1234567890abcdef..." // ✏️ Replace with actual vault address
  assetAddress={USDC_ADDRESS_BASE}
  assetSymbol="USDC"
  assetDecimals={6}
  name="Yearn V3 USDC Vault"
  description="Multi-strategy Yearn V3 vault for USDC on Base. Fully ERC-4626 compliant with standardized deposit, withdrawal, and pricing functions. Features maxLoss protection and automated yield optimization."
  estimatedApr={8.5} // ✏️ Update with real APR or fetch dynamically
  userAssetBalance={userUsdcBalance}
/>
```

4. **Remove or hide the placeholder "Coming Soon" card**

### Step 4: Configure APR (Optional)

You have three options for APR display:

**Option A: Static APR**

```typescript
estimatedApr={8.5} // Fixed percentage
```

**Option B: Fetch from Yearn API** (if available)

```typescript
// Create a new hook: hooks/useYearnApr.ts
const { data: apr } = useQuery({
  queryKey: ["yearn-apr", vaultAddress],
  queryFn: async () => {
    const response = await fetch(`https://api.yearn.fi/v1/chains/8453/vaults/${vaultAddress}`);
    const data = await response.json();
    return data.apy.net_apy * 100; // Convert to percentage
  },
});
```

**Option C: Calculate from Vault Data**

```typescript
// Use totalAssets and historical data to calculate APR
// This requires storing historical snapshots
```

For now, you can use **Option A** and update later.

### Step 5: Test the Integration

Before going live, test thoroughly:

#### Local Testing

1. **Connect Wallet:**
   - Use a testnet or small amount on mainnet
   - Ensure USDC balance available

2. **Test Deposit Flow:**

   ```
   ✓ Click "Deposit" button
   ✓ Enter amount (try 1 USDC)
   ✓ Verify preview shows expected shares
   ✓ Check approval is requested if needed
   ✓ Confirm deposit transaction
   ✓ Verify shares received in UI
   ```

3. **Test Withdrawal Flow:**

   ```
   ✓ Click "Withdraw" button
   ✓ Enter shares amount or use "MAX"
   ✓ Verify preview shows expected assets
   ✓ Set maxLoss (try 1%)
   ✓ Confirm withdrawal transaction
   ✓ Verify assets received
   ```

4. **Test Edge Cases:**
   ```
   ✓ Try depositing with insufficient balance
   ✓ Try withdrawing with no shares
   ✓ Test with maxLoss = 0% (should revert if any loss)
   ✓ Test "MAX" button functionality
   ✓ Verify transaction error handling
   ```

#### Monitoring

After deployment:

1. **Monitor first transactions:**
   - Watch Basescan for deposit/withdrawal txs
   - Verify share calculations are correct
   - Check gas usage is reasonable

2. **Check user feedback:**
   - Ensure loading states work
   - Verify error messages are helpful
   - Confirm success messages display

## 📊 Post-Deployment

### Analytics Setup

Consider tracking:

- Total deposits through your interface
- Number of unique depositors
- Average deposit size
- Withdrawal frequency
- User satisfaction

### Documentation Updates

Once live:

1. Update `README.md` with live vault addresses
2. Add screenshots to documentation
3. Create user guide for deposit/withdrawal
4. Document any gotchas discovered

### Maintenance

Regular tasks:

- [ ] Monitor vault TVL and APR
- [ ] Check for Yearn protocol upgrades
- [ ] Update APR data regularly
- [ ] Review transaction success rates
- [ ] Respond to user issues

## 🆘 Troubleshooting

### Common Issues

**"No vaults found"**

- Yearn V3 not yet deployed on Base
- Check Yearn Discord/Twitter for deployment announcements
- Verify registry address is correct

**"Transaction reverts"**

- Check maxLoss setting (try 100 = 1%)
- Verify sufficient allowance
- Ensure vault accepts deposits (check maxDeposit)

**"Incorrect share amount"**

- Verify you're using correct decimals (18 for shares, 6 for USDC)
- Check convertToShares preview before deposit
- Report if pricing seems wrong

**"Approval fails"**

- Check user has USDC balance
- Verify USDC contract address is correct
- Try manual approval on Basescan

## 📞 Support Resources

- **Yearn Discord:** https://discord.yearn.fi
- **Yearn Docs:** https://docs.yearn.fi/developers/v3/overview
- **Base Network:** https://docs.base.org
- **ERC-4626 Spec:** https://eips.ethereum.org/EIPS/eip-4626

## ✅ Final Checklist

Before going live:

- [ ] Registry query returns valid vault address
- [ ] Vault verified on Basescan
- [ ] YearnVaultCard uncommented and configured
- [ ] Deposit flow tested successfully
- [ ] Withdrawal flow tested successfully
- [ ] Error handling verified
- [ ] UI displays correctly on mobile
- [ ] Documentation updated
- [ ] Team notified of launch
- [ ] Monitoring setup complete

---

**Ready to launch?** Follow the steps above and your Yearn V3 integration will be live! 🚀
