"use client";

import { useEffect, useState } from "react";
import {
  CrossmintProvider,
  CrossmintAuthProvider,
  CrossmintWalletProvider,
} from "@crossmint/client-sdk-react-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { WagmiProvider } from "wagmi";
import { AaveProvider, AaveClient, production } from "@aave/react";

import { wagmiConfig } from "@/lib/wagmiConfig";
import { MembershipProvider } from "@/context/MembershipContext";
import { AuthProvider } from "@/context/AuthContext";
import { WalletProvisioner } from "@/components/auth/WalletProvisioner";
import { WalletRecoveryBootstrap } from "@/components/auth/WalletRecoveryBootstrap";
import { WalletProvisioningProvider } from "@/context/WalletProvisioningContext";

const aaveClient = AaveClient.create({
  environment: {
    ...production,
    backend: "/api/aave/graphql",
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

const walletConnectMissing =
  !process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID && process.env.NODE_ENV !== "production";

if (walletConnectMissing) {
  console.warn(
    "⚠️ NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. WalletConnect will be disabled."
  );
}

if (!process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY) {
  throw new Error("NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY is not set");
}

if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_CHAIN_ID === "base-sepolia") {
  console.warn("⚠️ Base Sepolia detected in production. Forcing Base mainnet.");
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const handler = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? String(event.reason ?? "");
      if (msg.includes("Service panicked") || msg.includes("InvariantError")) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <AaveProvider client={aaveClient}>
          <CrossmintProvider apiKey={process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY || ""}>
            <CrossmintAuthProvider
              loginMethods={["email", "google"]}
              authModalTitle="Sign in via Crossmint"
              refreshRoute="/api/auth/crossmint/refresh"
              logoutRoute="/api/auth/crossmint/logout"
            >
              <AuthProvider>
                <CrossmintWalletProvider showPasskeyHelpers={true}>
                  <WalletProvisioningProvider>
                    <WalletProvisioner />
                    <WalletRecoveryBootstrap />
                    <MembershipProvider>
                      {children}
                      <Toaster richColors position="top-center" closeButton />
                    </MembershipProvider>
                  </WalletProvisioningProvider>
                </CrossmintWalletProvider>
              </AuthProvider>
            </CrossmintAuthProvider>
          </CrossmintProvider>
        </AaveProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
