# Setting Up Mainnet for Withdrawals

## Why Mainnet is Required

Coinbase Offramp is a real money service that converts crypto to fiat (USD, EUR, etc.) and deposits it into bank accounts. For security and regulatory reasons, it **only works with mainnet** (real) cryptocurrencies, not testnet tokens.

## Current Status

Your wallet is on: **base-sepolia (testnet)** ❌

You need to be on: **base (mainnet)** ✅

## Option 1: Switch to Base Mainnet in Your Wallet

### Using MetaMask:

1. Open MetaMask
2. Click the network dropdown at the top
3. Select "Base Mainnet"
4. If Base isn't listed, add it manually:
   - Network Name: `Base Mainnet`
   - RPC URL: `https://mainnet.base.org`
   - Chain ID: `8453`
   - Currency Symbol: `ETH`
   - Block Explorer: `https://basescan.org`

### Using Coinbase Wallet:

1. Open Coinbase Wallet
2. Tap Settings
3. Tap Active Network
4. Select "Base"

## Option 2: Configure Crossmint for Base Mainnet

If you're using Crossmint embedded wallets, you need to ensure users are created on Base mainnet.

Check your Crossmint configuration in your code and ensure it's set to `base` (not `base-sepolia`).

## Getting Mainnet USDC

To test withdrawals on mainnet, you'll need real USDC on Base:

### Method 1: Bridge from Ethereum

1. Go to [bridge.base.org](https://bridge.base.org/)
2. Connect your wallet
3. Bridge ETH or USDC from Ethereum to Base

### Method 2: Buy with Coinbase Onramp

1. Use your app's deposit functionality
2. Buy USDC directly on Base using Coinbase Onramp
3. This gives you real USDC that can be withdrawn

### Method 3: Use a DEX

1. Get some ETH on Base (via bridge or on-ramp)
2. Use a DEX like [Uniswap](https://app.uniswap.org/) to swap ETH for USDC

## Testing Withdrawals

Once you're on Base mainnet with real USDC:

1. ✅ Click "Withdraw" in your app
2. ✅ You'll be redirected to Coinbase Offramp
3. ✅ Complete KYC if required
4. ✅ Enter withdrawal amount
5. ✅ Confirm your bank account or Coinbase account
6. ✅ Approve the transaction in your wallet
7. ✅ Wait for confirmation

**Note:** The first withdrawal will require KYC (identity verification) through Coinbase.

## Security Considerations

### Mainnet = Real Money

When you switch to mainnet:

- 💰 All tokens have real monetary value
- 🔐 Use strong wallet security (hardware wallet recommended for large amounts)
- ⚠️ Double-check all addresses before sending transactions
- 🔒 Never share your private keys or seed phrase

### Start Small

For testing:

1. Start with a small amount (e.g., $10-20)
2. Verify the withdrawal works correctly
3. Then process larger amounts

## Supported Mainnet Chains for Withdrawals

Coinbase Offramp supports these mainnet chains:

| Chain    | Chain ID | Native Token | USDC Supported |
| -------- | -------- | ------------ | -------------- |
| Base     | 8453     | ETH          | ✅ Yes         |
| Ethereum | 1        | ETH          | ✅ Yes         |
| Polygon  | 137      | MATIC        | ✅ Yes         |
| Arbitrum | 42161    | ETH          | ✅ Yes         |
| Optimism | 10       | ETH          | ✅ Yes         |

**Base is recommended** as it has the lowest gas fees among Ethereum L2s.

## Troubleshooting

### "Withdrawals only work on mainnet" message

This means your wallet is still on a testnet. Follow the steps above to switch to mainnet.

### Transaction fails after switching to mainnet

Make sure you have:

1. Sufficient USDC balance (minimum $10)
2. Enough ETH for gas fees (~$0.01-0.05 on Base)
3. Your Coinbase API keys properly configured

### "Insufficient balance" error

Bridge or purchase more USDC on Base mainnet using one of the methods above.

## Back to Testnet Development

After testing withdrawals, you can switch back to testnet for continued development:

1. Switch your wallet back to base-sepolia
2. All non-withdrawal features will work on testnet
3. Only use mainnet when testing actual withdrawals

---

**Need help?** Check out:

- [Base Documentation](https://docs.base.org/)
- [Coinbase Offramp Docs](https://docs.cdp.coinbase.com/onramp/docs/offramp)
- Project's `WITHDRAWAL_TROUBLESHOOTING.md` for more details
