"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

interface WalletProvisioningContextValue {
  provisioningError: string | null;
  setProvisioningError: (error: unknown) => void;
  clearProvisioningError: () => void;
}

const WalletProvisioningContext = createContext<WalletProvisioningContextValue | null>(null);

/** Privy provisions embedded wallets automatically; this context remains for API compatibility. */
export const WalletProvisioningProvider = ({ children }: { children: ReactNode }) => {
  const setProvisioningError = useCallback((error: unknown) => {
    console.error("Wallet provisioning error:", error);
  }, []);

  const clearProvisioningError = useCallback(() => undefined, []);

  const value = useMemo(
    () => ({
      provisioningError: null,
      setProvisioningError,
      clearProvisioningError,
    }),
    [setProvisioningError, clearProvisioningError]
  );

  return (
    <WalletProvisioningContext.Provider value={value}>
      {children}
    </WalletProvisioningContext.Provider>
  );
};

export const useWalletProvisioning = () => {
  const context = useContext(WalletProvisioningContext);
  if (!context) {
    throw new Error("useWalletProvisioning must be used within a WalletProvisioningProvider");
  }

  return context;
};
