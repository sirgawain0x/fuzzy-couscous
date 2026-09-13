# Yearn V3 Integration - Quick Start Guide

This guide will help you get the Yearn V3 vault integration up and running.

## 🎯 What's Included

Your app now has a complete Yearn V3 integration with:

✅ **ERC-4626 compliant vault interactions**  
✅ **Deposit and withdrawal flows**  
✅ **MaxLoss protection for withdrawals**  
✅ **Real-time balance tracking**  
✅ **Transaction state management**  
✅ **User-friendly UI components**

## 🚀 Quick Setup (3 Steps)

### 1. Install Dependencies

```bash
pnpm install
```

This will install `tsx` (needed for the registry query tool).

### 2. Query for Available Vaults

Run the registry query tool to discover Yearn V3 vaults on Base:

```bash
pnpm yearn:query
```

**Expected Output:**

```
🔍 Querying Yearn V3 Registry on Base...

Found 1 endorsed USDC vault(s):

📦 Vault 1:
   Address: 0x1234567890abcdef...
   Type: Multi-Strategy
   Release Version: 3
   Deployed: 11/10/2025

✅ Query complete!
```

**If no vaults found:**

- Yearn V3 hasn't launched on Base yet
- The integration is ready and waiting
- Check [Yearn's Discord](https://discord.yearn.fi) for deployment updates

### 3. Activate the Vault

Once you have a vault address:

1. **Open:** `app/strategies/page.tsx`
2. **Find line ~246** (the commented YearnVaultCard)
3. **Uncomment and update the address:**

```typescript
<YearnVaultCard
  vaultAddress="0x1234567890abcdef..." // ← Paste the vault address here
  assetAddress={USDC_ADDRESS_BASE}
  assetSymbol="USDC"
  assetDecimals={6}
  name="Yearn V3 USDC Vault"
  description="Multi-strategy Yearn V3 vault for USDC on Base. Fully ERC-4626 compliant with standardized deposit, withdrawal, and pricing functions. Features maxLoss protection and automated yield optimization."
  estimatedApr={8.5}
  userAssetBalance={userUsdcBalance}
/>
```

4. **Save and restart dev server:**

```bash
pnpm dev
```

5. **Navigate to `/strategies`** and you'll see the live vault!

## 📚 Key Features

### Deposit Flow

Users can deposit USDC into the vault:

1. Click **"Deposit"** button
2. Enter amount (or click **"MAX"**)
3. Preview shows expected vault shares
4. Approve USDC (if first time)
5. Confirm deposit transaction
6. Receive vault shares

### Withdrawal Flow

Users can withdraw at any time:

1. Click **"Withdraw"** button
2. Enter shares to redeem (or click **"MAX"**)
3. Set **maxLoss** protection (default 1%)
4. Preview shows expected USDC back
5. Confirm withdrawal transaction
6. Receive USDC

### MaxLoss Protection

Yearn V3's unique safety feature:

- **Purpose:** Prevent unexpected losses during withdrawal
- **Default:** 1% (100 basis points)
- **User Control:** Adjustable in withdrawal modal
- **Behavior:** Transaction reverts if loss exceeds threshold

Example:

```
Expected: 1000 USDC
maxLoss: 1% (100 bps)
Minimum acceptable: 990 USDC

If vault can only return 980 USDC → Transaction REVERTS
If vault returns 995 USDC → Transaction SUCCEEDS
```

## 🔧 Configuration Options

### Multiple Vaults

To add more vaults, simply duplicate the `YearnVaultCard`:

```typescript
{/* USDC Vault */}
<YearnVaultCard
  vaultAddress="0xVault1..."
  assetAddress={USDC_ADDRESS_BASE}
  assetSymbol="USDC"
  name="Yearn V3 USDC Vault"
  // ... other props
/>

{/* DAI Vault */}
<YearnVaultCard
  vaultAddress="0xVault2..."
  assetAddress={DAI_ADDRESS_BASE}
  assetSymbol="DAI"
  name="Yearn V3 DAI Vault"
  // ... other props
/>
```

### Dynamic APR

To fetch real APR data:

**Option 1: Yearn API**

```typescript
const { data: aprData } = useQuery({
  queryKey: ["yearn-apr", vaultAddress],
  queryFn: async () => {
    const response = await fetch(`https://api.yearn.fi/v1/chains/8453/vaults/${vaultAddress}`);
    return response.json();
  },
});

const estimatedApr = aprData?.apy?.net_apy * 100;
```

**Option 2: Historical Calculation**

```typescript
// Track totalAssets over time and calculate APR
// from the change in value
```

### Vault Discovery

Use the `useYearnRegistry` hook to automatically discover vaults:

```typescript
import { useYearnRegistry } from "@/hooks/useYearnRegistry";
import { USDC_ADDRESS_BASE } from "@/lib/config/yearn";

function StrategiesPage() {
  const { vaultAddresses, isLoading } = useYearnRegistry(USDC_ADDRESS_BASE);

  return (
    <div>
      {vaultAddresses.map((address) => (
        <YearnVaultCard
          key={address}
          vaultAddress={address}
          assetAddress={USDC_ADDRESS_BASE}
          // ... other props
        />
      ))}
    </div>
  );
}
```

## 📖 API Reference

### Hooks

#### `useYearnRegistry(assetAddress)`

Fetch endorsed vaults for an asset.

**Returns:**

- `vaultAddresses: Address[]` - Array of vault addresses
- `isLoading: boolean`
- `error: Error | null`
- `refetch: () => void`

#### `useYearnVault(vaultAddress)`

Get vault details.

**Returns:**

- `totalAssets: bigint` - Total assets under management
- `assetAddress: Address` - Underlying token address
- `vaultInfo: VaultInfo` - Vault metadata

#### `useYearnDeposit(vaultAddress, assetAddress)`

Handle deposits with approval.

**Returns:**

- `deposit: (assets, receiver) => Promise<void>`
- `state: { status, txHash, error }`
- `reset: () => void`

#### `useYearnWithdraw(vaultAddress)`

Handle withdrawals with maxLoss.

**Returns:**

- `redeem: (shares, receiver, owner, maxLoss) => Promise<void>`
- `state: { status, txHash, error }`
- `reset: () => void`

### Components

#### `<YearnVaultCard />`

Display vault with deposit/withdraw actions.

**Props:**

```typescript
{
  vaultAddress: Address;
  assetAddress: Address;
  assetSymbol?: string;
  assetDecimals?: number;
  name: string;
  description: string;
  estimatedApr?: number;
  userAssetBalance?: bigint;
}
```

#### `<YearnVaultModal />`

Modal for deposit/withdrawal flows.

**Props:**

```typescript
{
  open: boolean;
  onClose: () => void;
  vaultAddress?: Address;
  assetAddress?: Address;
  assetSymbol?: string;
  mode: "deposit" | "withdraw";
  userAssetBalance?: bigint;
  assetDecimals?: number;
}
```

## 🧪 Testing

### Local Testing Checklist

Before production:

- [ ] Query registry successfully
- [ ] Vault address verified on Basescan
- [ ] Deposit flow works end-to-end
- [ ] Withdrawal flow works end-to-end
- [ ] MaxLoss protection triggers correctly
- [ ] Error handling displays properly
- [ ] Mobile UI looks good
- [ ] Loading states work
- [ ] Transaction links open correctly

### Test Scenarios

1. **First-time deposit:**
   - Requires approval
   - Shows approval + deposit states

2. **Subsequent deposit:**
   - Skips approval
   - Goes straight to deposit

3. **Full withdrawal:**
   - Use "MAX" button
   - Redeems all shares

4. **Partial withdrawal:**
   - Enter custom amount
   - Leaves remaining shares

5. **MaxLoss edge cases:**
   - Set to 0% (should revert if any loss)
   - Set to 100% (allows any loss)
   - Set to 1% (standard protection)

## 📊 Monitoring

### Transaction Status

All transactions include:

- Loading state during confirmation
- Success message with Basescan link
- Error message if failed
- Automatic balance refresh after success

### Console Logging

For debugging, check browser console:

```typescript
// Deposit state changes:
"Deposit: idle → approving → depositing → success";

// Withdrawal state:
"Withdraw: idle → redeeming → success";
```

## 🆘 Troubleshooting

### "No vaults found"

**Solution:** Yearn V3 not yet on Base. Wait for deployment.

### "Transaction reverts"

**Check:**

- MaxLoss setting (try 100 bps = 1%)
- Sufficient USDC balance
- Sufficient gas

### "Approval fails"

**Check:**

- USDC balance > 0
- Connected to Base network
- Wallet has ETH for gas

### "Incorrect share preview"

**Verify:**

- Asset decimals correct (6 for USDC)
- Share decimals correct (18)
- Vault totalAssets loading

## 🔗 Resources

- **[Full Integration Guide](./YEARN_V3_INTEGRATION.md)** - Complete technical docs
- **[Deployment Checklist](../DEPLOYMENT_CHECKLIST.md)** - Step-by-step activation
- **[Yearn V3 Docs](https://docs.yearn.fi/developers/v3/overview)** - Official documentation
- **[ERC-4626 Spec](https://eips.ethereum.org/EIPS/eip-4626)** - Standard reference

## 💡 Pro Tips

1. **Set realistic APR:** Don't promise fixed returns. Use "Estimated" or "Variable"

2. **Test with small amounts:** Use 1 USDC for first production test

3. **Monitor gas costs:** Track average deposit/withdrawal gas usage

4. **User education:** Add tooltip explaining maxLoss to users

5. **Track analytics:** Log deposit/withdrawal counts for insights

## 🎉 You're Ready!

Your Yearn V3 integration is production-ready. Once vaults launch on Base:

1. Run `pnpm yearn:query`
2. Copy the vault address
3. Update `app/strategies/page.tsx`
4. Deploy and celebrate! 🚀

---

**Need help?** Open an issue or check the [full documentation](./YEARN_V3_INTEGRATION.md).
