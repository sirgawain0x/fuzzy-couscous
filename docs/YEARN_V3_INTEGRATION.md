# Yearn V3 Integration Guide

This document describes the Yearn V3 vault integration in the Creative Bank DeFi application.

## Overview

The integration follows Yearn V3 best practices and implements full ERC-4626 compliance for standardized vault interactions. All deposit, withdrawal, and pricing functions adhere to the tokenized vault standard.

## Architecture

### Configuration (`lib/config/yearn.ts`)

Core Yearn V3 contract addresses and ABIs:

- **Protocol Address Provider**: `0x775F09d6f3c8D2182DFA8bce8628acf51105653c`
  - Top-level directory for all protocol contracts
- **V3 Registry**: `0xd40ecF29e001c76Dcc4cC0D9cd50520CE845B038`
  - Retrieve endorsed vaults by asset
- **ERC-4626 ABI**: Standard vault interface functions
- **Registry ABI**: Functions to query vault information

### Utilities (`lib/yearnUtils.ts`)

Helper functions for:

- Share/asset conversions
- Price per share calculations
- APR/APY conversions
- Format vault balances and USD values
- Max loss validation and conversion

### Hooks

#### `useYearnVaults.ts`

- `useYearnVaults`: Fetch all endorsed vaults for an asset
- `useYearnVault`: Get specific vault details
- `useYearnVaultBalance`: Get user's share balance and asset value
- `useMaxDeposit`: Query maximum deposit amount
- `usePreviewDeposit`: Preview expected shares from deposit
- `usePreviewRedeem`: Preview expected assets from withdrawal

#### `useYearnDeposit.ts`

- `useYearnDeposit`: Handle deposit flow with token approval
- Automatically checks allowance and requests approval if needed
- Executes deposit transaction after approval

#### `useYearnWithdraw.ts`

- `useYearnWithdraw`: Handle withdrawal using `redeem` (recommended)
- `useYearnWithdrawAssets`: Handle withdrawal using `withdraw`
- Supports maxLoss parameter in basis points

### Components

#### `YearnVaultModal.tsx`

Full-featured modal for deposits and withdrawals:

- Input validation
- Balance checking
- Preview calculations
- Max loss configuration (withdrawals)
- Transaction status tracking
- Error handling

#### `YearnVaultCard.tsx`

Display component for vault strategies:

- Shows APR and TVL
- User position tracking
- Deposit/withdraw actions
- ERC-4626 compliance badge

## User Flows

### Deposit Flow

1. **Token Approval** (if needed)

   ```typescript
   token.approve(vault, amount);
   ```

2. **Vault Deposit**

   ```typescript
   vault.deposit(amount, receiver);
   ```

3. **Receive Shares**
   - Shares minted based on `convertToShares(amount)`

### Withdrawal Flow (Recommended: Redeem)

1. **Preview Withdrawal**

   ```typescript
   expectedAssets = vault.convertToAssets(shares);
   ```

2. **Execute Redeem**

   ```typescript
   vault.redeem(shares, receiver, owner, maxLoss);
   ```

   - `maxLoss`: Basis points (default: 10000 = 100%)
   - Recommended: Set to 100 (1%) for standard withdrawals

3. **Receive Assets**
   - Assets returned to receiver address

## ERC-4626 Standard Functions

### View Functions

- `asset()`: Underlying token address
- `totalAssets()`: Total assets under management
- `convertToShares(assets)`: Preview deposit
- `convertToAssets(shares)`: Preview withdrawal
- `maxDeposit(receiver)`: Maximum deposit amount
- `maxRedeem(owner)`: Maximum redeemable shares
- `balanceOf(account)`: User's share balance

### State-Changing Functions

- `deposit(assets, receiver)`: Deposit assets, receive shares
- `redeem(shares, receiver, owner, maxLoss?)`: Burn shares, receive assets
- `withdraw(assets, receiver, owner, maxLoss?)`: Withdraw assets, burn shares

## Max Loss Protection

Yearn V3 introduces optional `maxLoss` parameters:

- **Redeem**: Defaults to 10000 (100% loss allowed)
- **Withdraw**: Defaults to 0 (0% loss allowed)

**Best Practice**: Always include `maxLoss` when possible for the final withdrawal step.

```typescript
// Recommended: 1% max loss
const maxLossBps = 100;
await vault.redeem(shares, receiver, owner, maxLossBps);
```

## Pricing and Accounting

Use standard ERC-4626 functions for pricing:

```typescript
// Get share value
const assetValue = vault.convertToAssets(shareBalance);

// Get expected shares
const expectedShares = vault.convertToShares(depositAmount);
```

**Security Note**: Do not use `pricePerShare()` for on-chain integrations due to precision loss. It's only for off-chain helpers.

## Contract Addresses on Base Mainnet

| Contract                  | Address                                      |
| ------------------------- | -------------------------------------------- |
| Protocol Address Provider | `0x775F09d6f3c8D2182DFA8bce8628acf51105653c` |
| V3 Registry               | `0xd40ecF29e001c76Dcc4cC0D9cd50520CE845B038` |
| USDC                      | `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` |

## Vault Categories

Category 1 vaults are generally:

- Lowest risk
- Most similar to V2 style vaults
- Conservative strategy allocation

Higher category numbers indicate more aggressive strategies.

## Integration Checklist

- [x] ERC-4626 compliant vault interface
- [x] Standardized deposit/withdrawal flows
- [x] Max loss protection for withdrawals
- [x] Transparent on-chain pricing
- [x] Registry integration for endorsed vaults
- [x] Share/asset conversion utilities
- [x] User balance tracking
- [x] Transaction status handling
- [x] Error handling and validation

## Usage Example

```typescript
import { YearnVaultCard } from "@/components/yearn/YearnVaultCard";
import { USDC_ADDRESS_BASE } from "@/lib/config/yearn";

// In your component
<YearnVaultCard
  vaultAddress="0x..." // Yearn V3 vault address
  assetAddress={USDC_ADDRESS_BASE}
  assetSymbol="USDC"
  assetDecimals={6}
  name="Yearn V3 USDC Vault"
  description="Multi-strategy vault for USDC"
  estimatedApr={8.5}
  userAssetBalance={userBalance}
/>
```

## Resources

- [Yearn V3 Documentation](https://docs.yearn.fi/developers/v3/overview)
- [ERC-4626 Standard](https://eips.ethereum.org/EIPS/eip-4626)
- [Yearn V3 GitHub](https://github.com/yearn/yearn-vaults-v3)

## Support

For integration questions or issues, refer to:

- Yearn Discord: https://discord.yearn.fi
- Developer Docs: https://docs.yearn.fi
