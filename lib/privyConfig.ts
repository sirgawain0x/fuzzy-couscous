import type { PrivyClientConfig } from "@privy-io/react-auth";
import { base, baseSepolia } from "viem/chains";

import { robinhoodChain } from "@/lib/config/robinhood";
import { appChain } from "@/lib/wagmiConfig";

const defaultChain = appChain.id === base.id ? base : baseSepolia;

export const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

/**
 * Custom Privy API host used when HttpOnly cookies are enabled
 * (e.g. https://privy.finance.creativeplatform.xyz).
 * Leave unset in local/dev when cookies are disabled.
 */
export const privyApiUrl = process.env.NEXT_PUBLIC_PRIVY_API_URL?.trim() || undefined;

export const privyConfig: PrivyClientConfig = {
  loginMethods: ["email", "google"],
  appearance: {
    theme: "light",
    accentColor: "#0074D9",
    // Do not point at a missing asset — /icon.png 404s in prod and can break Privy UI init.
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
  defaultChain,
  supportedChains: [base, baseSepolia, robinhoodChain],
};
