/**
 * Privy Earn vault configured in the Privy Dashboard
 * (Wallet infrastructure > Earn).
 *
 * Live name, APY, and TVL come from GET /api/earn/vault — do not hardcode
 * the underlying Morpho curator here.
 */

export const PRIVY_EARN_VAULT_ID =
  process.env.NEXT_PUBLIC_PRIVY_EARN_VAULT_ID ?? "wawi07rarv7tntzfepl0sks4";

export const PRIVY_EARN_DISPLAY = {
  title: "Privy Earn USDC",
  subtitle: "Yield vault with Privy fee wrapper on Base",
  description:
    "Deposit USDC from your Creative Finance wallet into a yield vault. Privy handles approval and deposit in one action, and routes a share of yield to Creative Finance via the dashboard fee wrapper.",
} as const;

export const PRIVY_EARN_DISCLAIMER =
  "Privy does not control DeFi vaults or underlying protocols. Earnings are generated from third-party vaults and are not guaranteed. Using vaults involves risk, including loss of funds. This is not investment advice.";
