# Kalani Vault & Crossmint GOAT Agent Integration

This guide describes how to route the Yearn Kalani (ERC-4626) vault and Creative Bank Bouncer into the Creative Bank frontend and the Crossmint GOAT AI agent.

## Addresses (Base)

| Contract                            | Address                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------- |
| USDC                                | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`                            |
| Creative Bank Kalani Vault (cbUSDC) | `0xec8C6e90e8e84A368cbF2c2fd13DdF67884Ec5EE`                            |
| Yearn V3 USDC Allocator Vault       | `0xb13CF163d916917d9cD6E836905cA5f12a1dEF4B`                            |
| Creative Bank Bouncer               | Set after deploy; configure `NEXT_PUBLIC_CREATIVE_BANK_BOUNCER_ADDRESS` |

## 1. Frontend wiring (Wagmi/Viem)

- **Eligibility:** Use `useReadContract` (or the `useKalaniDepositEligibility` hook) with the Bouncer contract and `availableDepositLimit(userAddress)`. If the result is `> 0`, the user is allowed to deposit.
- **Deposit flow:** Standard ERC-4626: approve USDC for the vault, then call `vault.deposit(assets, receiver)`.
- **Vault config:** `CREATIVE_BANK_VAULT` and optional `CREATIVE_BANK_BOUNCER_ADDRESS` are in `lib/config/kalani.ts`. When the bouncer address is set, `YearnVaultCard` gates the Deposit button on `availableDepositLimit`.

## 2. GOAT agent – registering the deposit tool

Give the GOAT agent the ability to deposit into the Kalani vault by registering the vault as an ERC-4626 tool. Example (backend/agent setup):

```typescript
import { goat } from "@crossmint/goat-sdk";
import { erc4626 } from "@crossmint/goat-sdk-erc4626";

const tools = await goat.getTools({
  plugins: [
    erc4626({
      vaults: [
        {
          address: "0xec8C6e90e8e84A368cbF2c2fd13DdF67884Ec5EE",
          name: "Yearn Kalani USDC Vault (Creative Bank)",
        },
        // Optional: official Yearn USDC vault
        {
          address: "0xb13CF163d916917d9cD6E836905cA5f12a1dEF4B",
          name: "Yearn V3 USDC Vault",
        },
      ],
    }),
  ],
});
```

Use the vault address that is actually gated by your Bouncer (e.g. Creative Bank vault `0xec8C...` if that’s the one with `set_deposit_limit_module(bouncer)`).

## 3. Smart teller logic (system prompt)

Instruct the agent to check the Bouncer before suggesting a deposit and to handle non-members gracefully.

**Suggested system instructions for GOAT:**

```text
You are the Creative Bank Teller.

If a user asks for high yield or wants to earn more on USDC:
1. Check their membership status by calling the availableDepositLimit function on the Bouncer contract (address: [YOUR_DEPLOYED_BOUNCER_ADDRESS]) with the user's wallet address.
2. If the limit is 0: explain that the Yearn Kalani vault is a VIP feature and offer to help them get a Creative Brand, Investor, or Creator membership NFT.
3. If the limit is greater than 0: explain the benefits of the Yearn vault and ask for permission to deposit their USDC.

When the user confirms a deposit, use the ERC-4626 deposit tool for the Yearn Kalani USDC Vault (Creative Bank) with their USDC amount and their wallet as receiver.
```

Replace `[YOUR_DEPLOYED_BOUNCER_ADDRESS]` with the deployed Creative Bank Bouncer address.

## 4. User experience flow

1. **User:** “I want to earn more on my USDC.”
2. **GOAT:** Calls `Bouncer.availableDepositLimit(userAddress)`.
3. **No NFT:** GOAT responds: “The Kalani Vault is for members only. Would you like to see our Creator Membership options?”
4. **Has NFT:** GOAT responds: “You’re all set. As a member, I can move your USDC into the Kalani Vault for optimized yield. Shall I proceed?”
5. **Execution:** On confirmation, GOAT triggers the deposit transaction via Crossmint’s wallet infrastructure (approve + `vault.deposit(assets, receiver)`).

## 5. Real-time data (yDaemon)

To show “Live APY” or “Total earnings” in the Creative Bank app without heavy on-chain logic, use the [Yearn yDaemon API](https://docs.yearn.fi/). Query the vault by address (e.g. `0xec8C6e90e8e84A368cbF2c2fd13DdF67884Ec5EE` or `0xb13CF163d916917d9cD6E836905cA5f12a1dEF4B`) for current yield and historical returns. The app already uses `useKalaniApr` for estimated APY; you can extend it to use yDaemon for consistency.

## 6. Bouncer deployment and vault configuration

1. Deploy the Bouncer: run `forge script script/DeployCreativeBankBouncer.s.sol --rpc-url base --broadcast` (with `PRIVATE_KEY` set). Constructor args are the Creative Brand, Investor, and Creator NFT (Unlock lock) addresses.
2. Set env: `NEXT_PUBLIC_CREATIVE_BANK_BOUNCER_ADDRESS=<bouncer_address>`.
3. Point the vault at the Bouncer: as the vault owner, call `set_deposit_limit_module(bouncerAddress)` on the Yearn V3 vault contract.

After that, only addresses with a Creative Brand, Investor, or Creator NFT can deposit (on-chain). The UI and GOAT agent use the same Bouncer for a consistent “members only” experience.
