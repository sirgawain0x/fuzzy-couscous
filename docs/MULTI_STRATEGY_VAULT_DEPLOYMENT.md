# Multi-Strategy Vault Deployment Guide

## Overview

This document describes the deployment process for the Creative Bank Multi-Strategy USDC Vault using Yearn V3 infrastructure.

## Architecture

The vault consists of:

1. **Allocator Vault** - Yearn V3 multi-strategy vault that allocates capital
2. **4 Tokenized Strategies** - Individual ERC-4626 vaults:
   - Aave V3 Strategy
   - Compound V3 Strategy
   - Curve 3pool Strategy
   - Spark Protocol Strategy

## Prerequisites

### Environment Variables

Create a `.env` file in the project root:

```bash
# Deployment wallet private key (keep secure!)
PRIVATE_KEY=your_private_key_here

# Governance and management addresses (must be different!)
GOVERNANCE_ADDRESS=0x... # Multi-sig recommended
MANAGEMENT_ADDRESS=0x... # Can be EOA

# RPC URL for Base mainnet
RPC_URL_BASE=https://mainnet.base.org

# Basescan API key for contract verification
BASESCAN_API_KEY=your_api_key_here

# Strategy addresses (set after deploying strategies)
AAVE_STRATEGY=0x...
COMPOUND_STRATEGY=0x...
CURVE_STRATEGY=0x...
SPARK_STRATEGY=0x...

# Vault address (set after deploying vault)
VAULT_ADDRESS=0x...
```

### Wallet Requirements

- **Deployment Address**: Needs ETH for gas fees
- **Governance Address**: Controls vault (multi-sig recommended)
- **Management Address**: Daily operations (can be EOA)

**Important**: Governance and management addresses must be different!

## Deployment Steps

### Step 1: Deploy Strategies

Deploy all 4 Tokenized Strategies:

```bash
forge script script/DeployStrategies.s.sol:DeployStrategies \
  --rpc-url base \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

This will:

- Deploy Aave V3 Strategy
- Deploy Compound V3 Strategy
- Deploy Curve Strategy
- Deploy Spark Strategy

**Save the deployed addresses** and update your `.env` file.

### Step 2: Deploy Allocator Vault

Deploy the vault infrastructure:

```bash
forge script script/DeployVault.s.sol:DeployVault \
  --rpc-url base \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

This will:

- Deploy RoleManager via RoleManagerFactory
- Deploy Accountant
- Deploy DebtAllocator
- Deploy Registry
- Deploy the Allocator Vault

**Save the vault address** and update your `.env` file.

### Step 3: Add Strategies to Vault

Add all strategies to the vault and configure max debt:

```bash
forge script script/AddStrategies.s.sol:AddStrategies \
  --rpc-url base \
  --broadcast
```

This will:

- Add all 4 strategies to the vault
- Set max debt limits for each strategy

## Post-Deployment Configuration

### Update Frontend Configuration

Update `lib/config/multiStrategyVault.ts` with deployed addresses:

```typescript
export const MULTI_STRATEGY_VAULT = {
  vaultAddress: "0x..." as Address, // Your deployed vault
  strategies: {
    aave: "0x..." as Address,
    compound: "0x..." as Address,
    curve: "0x..." as Address,
    spark: "0x..." as Address,
  },
  // ... rest of config
};
```

### Initial Capital Allocation

After deployment, you'll need to allocate initial capital to strategies. This can be done via:

1. **Manual Allocation**: Call `vault.update_debt(strategy, amount)` for each strategy
2. **Debt Allocator**: Configure automated allocation via DebtAllocator contract

## Monitoring & Maintenance

### Regular Operations

1. **Harvest Strategies**: Call `vault.process_report(strategy)` for each strategy periodically
2. **Rebalance Allocations**: Adjust debt allocations based on performance
3. **Monitor Performance**: Track APR and TVL across strategies

### Key Metrics to Track

- Total Value Locked (TVL)
- Strategy allocations (how much in each)
- Individual strategy APRs
- Vault share price
- User deposits/withdrawals

## Contract Addresses

### Base Mainnet

- **USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Yearn RoleManagerFactory**: `0xca12459a931643BF28388c67639b3F352fe9e5Ce`
- **Yearn Protocol Address Provider**: `0x775F09d6f3c8D2182DFA8bce8628acf51105653c`

### Protocol Addresses

See `contracts/config/BaseAddresses.sol` for:

- Aave V3 Pool
- Compound V3 Comet
- Curve 3pool
- Spark Pool

## Security Considerations

1. **Start Small**: Deploy with small allocations first
2. **Test Thoroughly**: Use Base Sepolia testnet first
3. **Multi-Sig Governance**: Use multi-sig for governance address
4. **Monitor Closely**: Watch first transactions carefully
5. **Regular Audits**: Consider professional audits before scaling

## Troubleshooting

### "Governance and management must be different"

Make sure `GOVERNANCE_ADDRESS` and `MANAGEMENT_ADDRESS` are different addresses in your `.env`.

### "Strategy deployment failed"

Check:

- Sufficient ETH for gas
- Correct RPC URL
- Base network connectivity

### "Cannot add strategy to vault"

Ensure:

- You're using the management address
- Strategy is deployed and verified
- Vault deployment completed successfully

## Next Steps

1. Update frontend configuration with deployed addresses
2. Add vault to strategies page
3. Test deposit/withdraw flows
4. Monitor initial performance
5. Gradually increase allocations

## Resources

- [Yearn V3 Documentation](https://docs.yearn.fi/developers/v3/overview)
- [Tokenized Strategy Guide](https://docs.yearn.fi/developers/v3/tokenized-strategies)
- [Base Network Docs](https://docs.base.org)
