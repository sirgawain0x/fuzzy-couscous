"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getProvisioningErrorMessage } from "@/lib/walletProvisioningError";

interface WalletProvisioningContextValue {
  provisioningError: string | null;
  setProvisioningError: (error: unknown) => void;
  clearProvisioningError: () => void;
}

const WalletProvisioningContext = createContext<WalletProvisioningContextValue | null>(null);

export const WalletProvisioningProvider = ({ children }: { children: ReactNode }) => {
  const [provisioningError, setProvisioningErrorState] = useState<string | null>(null);

  const setProvisioningError = useCallback((error: unknown) => {
    console.error("Failed to provision Crossmint wallet:", error);
    setProvisioningErrorState(getProvisioningErrorMessage(error));
  }, []);

  const clearProvisioningError = useCallback(() => {
    setProvisioningErrorState(null);
  }, []);

  const value = useMemo(
    () => ({
      provisioningError,
      setProvisioningError,
      clearProvisioningError,
    }),
    [provisioningError, setProvisioningError, clearProvisioningError]
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
