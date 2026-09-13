export const VALID_CHAINS = ["base", "base-sepolia"] as const;
export type ValidChain = (typeof VALID_CHAINS)[number];

export const getWalletChain = (): ValidChain => {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredChain = process.env.NEXT_PUBLIC_CHAIN_ID;

  if (isProduction) {
    return "base";
  }

  return VALID_CHAINS.includes(configuredChain as ValidChain)
    ? (configuredChain as ValidChain)
    : "base-sepolia";
};

type EmailRecovery = { type: "email"; email: string } | { type: "email" };

export const buildEmailRecovery = (email?: string): EmailRecovery => {
  if (email) {
    return { type: "email", email };
  }

  return { type: "email" };
};
