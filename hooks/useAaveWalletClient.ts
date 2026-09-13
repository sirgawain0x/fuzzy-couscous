"use client";

import { useWalletClient } from "wagmi";

/**
 * Returns a viem WalletClient suitable for Aave transactions.
 * Privy embedded wallets are connected through wagmi via @privy-io/wagmi.
 */
export function useAaveWalletClient() {
  const { data: walletClient } = useWalletClient();
  return walletClient ?? undefined;
}
