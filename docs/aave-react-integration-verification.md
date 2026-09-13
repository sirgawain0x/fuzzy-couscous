# Aave React Integration Verification

Verification against the updated Aave rules (with React instructions) in `.cursor/rules/`.

---

## 1. Deploy (`aave-earn-vault-deploy.mdc`)

| Rule                                                                                                                                                               | Implementation                                                                                                     | Status |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------ |
| **VaultDeployRequest** from `@aave/react`: market, chainId, underlyingToken, deployer, initialFee, shareName, shareSymbol, initialLockDeposit, optional recipients | `VaultDeployModal.tsx`: builds `request` with `evmAddress()`, `bigDecimal()` for initialFee and initialLockDeposit | ✅     |
| **useVaultDeploy** + **useSendTransaction(walletClient)**                                                                                                          | Same hooks used; walletClient from Crossmint or wagmi                                                              | ✅     |
| Handle **TransactionRequest** → send single tx                                                                                                                     | `plan.__typename === "TransactionRequest"` → `sendTransaction(plan)`                                               | ✅     |
| Handle **ApprovalRequired** → send approval then originalTransaction                                                                                               | `sendTransaction(plan.approval)` then `sendTransaction(plan.originalTransaction)`                                  | ✅     |
| Handle **InsufficientBalanceError** → user feedback                                                                                                                | Explicit check, set error message with `plan.required.value` and assetSymbol                                       | ✅     |
| Optional: combine loading/error from deploying + sending                                                                                                           | We use submit state (approval / deploying / success / error)                                                       | ✅     |

**Note:** The rule shows `deployVault(request).andThen((plan) => switch … errAsync(InsufficientBalanceError))`. We use sequential `deployVault(request)` then branch on `plan.__typename` and set error state for InsufficientBalanceError. Behavior is equivalent; we avoid depending on `errAsync` (neverthrow).

---

## 2. Data (`aave-earn-vault-data.mdc`)

| Rule                                                                         | Implementation                                                                                                                                   | Status |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| **useVault** – by (address \| txHash), chainId, user                         | Used indirectly via vault data from useVaults; `DeployedVaultCard` receives full `Vault` when from API                                           | ✅     |
| **useVaults** – criteria (ownedBy \| vaults), pageSize, user                 | `useOwnedVaults`: `useVaults({ criteria: { ownedBy: [evmAddress] }, user, pageSize: PageSize.Ten })`                                             | ✅     |
| **useUserVaults** – user, orderBy, pageSize (optional filters, cursor)       | `useUserVaultPositions`: `useUserVaults({ user, orderBy: { shares: OrderDirection.Desc }, pageSize: PageSize.Fifty })`                           | ✅     |
| **useVaultUserTransactionHistory** – user, vault, chainId, orderBy, pageSize | `VaultActivityModal`: `useVaultUserTransactionHistory({ user, vault, chainId, orderBy: { date: OrderDirection.Desc }, pageSize: PageSize.Ten })` | ✅     |
| **useVaultUserActivity** – user, vault, chainId, window                      | `VaultActivityModal`: `useVaultUserActivity({ user, vault, chainId, window: VaultUserActivityTimeWindow.LastWeek })`                             | ✅     |

**Note:** Rules doc uses `OrderDirection.DESC` in TypeScript examples; `@aave/react` exports `OrderDirection.Desc`. We use `OrderDirection.Desc` (SDK enum).

---

## 3. Operations (`aave-earn-vault-operations.mdc`)

| Rule                                                                                                                | Implementation                                                                                                                                    | Status |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **useVaultDepositPreview** – call `preview({ vault, chainId, amount })` (async)                                     | `AaveVaultModal`: `useVaultDepositPreview()`; preview called in `useEffect` when amount/mode change; result stored in state for “expected shares” | ✅     |
| **useVaultDeposit** + **useSendTransaction**; handle TransactionRequest, ApprovalRequired, InsufficientBalanceError | Deposit: `deposit(...)` then branch on `plan.__typename`; send single tx or approval+original; InsufficientBalanceError → set error message       | ✅     |
| **useVaultRedeemPreview** – async preview for redeem                                                                | Same pattern as deposit: `useVaultRedeemPreview()`, called in `useEffect`, “expected assets” from state                                           | ✅     |
| **useVaultRedeemShares** + **useSendTransaction**; result.andThen(sendTransaction)                                  | We await `redeem(...)`, then `sendTransaction(redeemResult.value)` (avoids andThen typing issue with ResultAsync)                                 | ✅     |

**Note:** We implement **deposit** (assets → shares) and **redeem** (shares → assets). Mint and withdraw are not in the current UI; the rules support all four operations if you want to add them later.

---

## 4. Management (`aave-earn-vault-management.mdc`)

| Rule                                                                                                    | Implementation                                                                                                       | Status |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| **useVaultSetFee** + **useSendTransaction**; setFee(...).andThen(sendTransaction)                       | `VaultManagementModal`: `setFee({ chainId, vault, newFee: bigDecimal(parsed) }).andThen(sendTransaction)`            | ✅     |
| **useVaultWithdrawFees** – amount: { exact: bigDecimal(n) } or { max: true }; then sendTransaction      | Same modal: `withdrawFees({ chainId, vault, amount }).andThen(sendTransaction)` with amount from form (exact or max) | ✅     |
| **useVaultTransferOwnership** + **useSendTransaction**; transferOwnership(...).andThen(sendTransaction) | Same modal: `transferOwnership({ chainId, vault, newOwner }).andThen(sendTransaction)`                               | ✅     |
| Optional: loading = settingFee.loading \|\| sending.loading                                             | We use `isBusy` combining all action + send loading states                                                           | ✅     |

---

## Summary

- **Deploy:** Matches React flow (useVaultDeploy, useSendTransaction, handle all three plan types). We use sequential branching instead of `errAsync`; behavior is the same.
- **Data:** useVaults (ownedBy + user), useUserVaults (user, orderBy, pageSize), useVaultUserTransactionHistory, useVaultUserActivity are all used as in the rules. We use `OrderDirection.Desc` from the SDK.
- **Operations:** Deposit and redeem use the correct preview and execution hooks; we handle TransactionRequest, ApprovalRequired, and InsufficientBalanceError for deposit and use sendTransaction for redeem.
- **Management:** Set fee, withdraw fees, and transfer ownership follow the rule pattern (action + useSendTransaction, .andThen(sendTransaction)).

No code changes are required for compliance with the updated React instructions. The only intentional differences are:

1. **Deploy / deposit:** We handle `InsufficientBalanceError` with explicit branching and `setErrorMessage` instead of `errAsync`, to avoid adding a neverthrow dependency.
2. **Redeem:** We use `await redeem()` then `await sendTransaction(value)` instead of `redeem().andThen(sendTransaction)` due to TypeScript/ResultAsync typing with the current SDK.
