import type { PrivyClientConfig } from "@privy-io/react-auth";
import { base, baseSepolia } from "viem/chains";

import { appChain } from "@/lib/wagmiConfig";

const defaultChain = appChain.id === base.id ? base : baseSepolia;

export const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export const privyConfig: PrivyClientConfig = {
  loginMethods: ["email", "google"],
  appearance: {
    theme: "light",
    accentColor: "#0074D9",
    logo: "/icon.png",
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
  defaultChain,
  supportedChains: [base, baseSepolia],
};
