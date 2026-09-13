# Deployment Instructions for Base Sepolia Testnet

## Prerequisites

1. **Environment Variables**: Ensure your `.env` file contains:

   ```bash
   PRIVATE_KEY=your_private_key_here
   BASESCAN_API_KEY=your_basescan_api_key_here
   GOVERNANCE_ADDRESS=0x... # Optional, defaults to deployer
   MANAGEMENT_ADDRESS=0x... # Optional, defaults to deployer
   ```

2. **Wallet Balance**: Ensure your deployment wallet has enough ETH on Base Sepolia for gas fees.

3. **Network Access**: Make sure you can connect to Base Sepolia RPC.

## Important Note About Testnet Addresses

The current `BaseAddresses.sol` file contains **Base Mainnet** addresses. For Base Sepolia testnet deployment, you may need to:

1. Verify that the protocols (Aave, Compound, Curve, Spark) are deployed on Base Sepolia
2. Update `BaseAddresses.sol` with testnet addresses if different
3. Or create a separate testnet config file

**Yearn V3 Infrastructure**: The RoleManagerFactory address (`0xca12459a931643BF28388c67639b3F352fe9e5Ce`) should be the same across all networks, but verify this.

## Deployment Steps

### Step 1: Deploy Strategies

Deploy all 4 Tokenized Strategies to Base Sepolia:

```bash
forge script script/DeployStrategies.s.sol:DeployStrategies \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv
```

**Save the deployed addresses** from the console output and update your `.env` file:

```bash
AAVE_STRATEGY=0x...
COMPOUND_STRATEGY=0x...
CURVE_STRATEGY=0x...
SPARK_STRATEGY=0x...
```

### Step 2: Deploy Vault

Deploy the Allocator Vault:

```bash
forge script script/DeployVault.s.sol:DeployVault \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv
```

**Save the vault address** and update your `.env` file:

```bash
VAULT_ADDRESS=0x...
```

### Step 3: Add Strategies to Vault

Add all strategies to the vault:

```bash
forge script script/AddStrategies.s.sol:AddStrategies \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv
```

## Verification

After deployment, verify contracts on Basescan:

- Go to https://sepolia.basescan.org/
- Search for your deployed contract addresses
- Verify they are verified and readable

## Troubleshooting

### "PRIVATE_KEY not found"

- Ensure `.env` file exists in project root
- Check that `PRIVATE_KEY` is set (without `0x` prefix)

### "Insufficient funds"

- Get Base Sepolia ETH from a faucet
- Check your wallet balance

### "Contract verification failed"

- Ensure `BASESCAN_API_KEY` is set correctly
- Check that compiler settings match `foundry.toml`

### "Strategy addresses not found"

- Make sure you deployed strategies first (Step 1)
- Verify addresses are correct in `.env`

## Next Steps

After successful deployment:

1. Update `lib/config/multiStrategyVault.ts` with deployed addresses
2. Test deposit/withdraw functionality
3. Monitor vault performance
4. Consider upgrading to mainnet after thorough testing
