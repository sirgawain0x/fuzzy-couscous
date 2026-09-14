"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AaveProvider, AaveClient, production } from "@aave/react";

import { wagmiConfig } from "@/lib/wagmiConfig";
import { privyApiUrl, privyAppId, privyConfig } from "@/lib/privyConfig";
import { MembershipProvider } from "@/context/MembershipContext";
import { AuthProvider } from "@/context/AuthContext";
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

  // Avoid throwing at module evaluation — that aborts Next.js SSG/prerender on Vercel
  // when NEXT_PUBLIC_PRIVY_APP_ID is missing from the build environment.
  if (!isMounted) {
    return null;
  }

  if (!privyAppId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-red-600">
        NEXT_PUBLIC_PRIVY_APP_ID is not set. Add it in the Vercel project environment
        variables and redeploy.
      </div>
    );
  }

  const privyProviderProps = {
    appId: privyAppId,
    config: privyConfig,
    ...(privyApiUrl ? { apiUrl: privyApiUrl } : {}),
  };

  return (
    // apiUrl is a documented beta PrivyProvider prop for custom HttpOnly cookie domains.
    <PrivyProvider {...(privyProviderProps as ComponentProps<typeof PrivyProvider>)}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <AaveProvider client={aaveClient}>
            <AuthProvider>
              <WalletProvisioningProvider>
                <MembershipProvider>
                  {children}
                  <Toaster richColors position="top-center" closeButton />
                </MembershipProvider>
              </WalletProvisioningProvider>
            </AuthProvider>
          </AaveProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
