"use client";

import { useMemo } from "react";
import { useWalletClient } from "wagmi";
import { useWallet, EVMWallet } from "@crossmint/client-sdk-react-ui";
import { createWalletClient, custom, type WalletClient } from "viem";
import { base, baseSepolia } from "viem/chains";

/**
 * Returns a viem WalletClient suitable for Aave transactions.
 * Prefers Crossmint EVMWallet when the user is logged in via Crossmint;
 * otherwise falls back to wagmi's wallet client (e.g. MetaMask, WalletConnect).
 */
export function useAaveWalletClient(): WalletClient | undefined {
  const { data: wagmiWalletClient } = useWalletClient();
  const { wallet: crossmintWallet } = useWallet();

  return useMemo((): WalletClient | undefined => {
    if (crossmintWallet) {
      try {
        const evmWallet = EVMWallet.from(crossmintWallet);
        const chain = process.env.NODE_ENV === "production" ? base : baseSepolia;
        return createWalletClient({
          chain,
          transport: custom({
            async request({ method, params }) {
              if (method === "eth_sendTransaction" && params?.[0]) {
                const tx = params[0] as {
                  to?: string;
                  value?: string;
                  data?: string;
                };
                if (!tx.to) throw new Error("Transaction 'to' address is required");
                const valueBigInt = BigInt(tx.value || "0x0");
                const result = await evmWallet.sendTransaction({
                  to: tx.to as `0x${string}`,
                  value: valueBigInt,
                  data: (tx.data || "0x") as `0x${string}`,
                });
                return result.hash;
              }
              if (method === "eth_accounts" || method === "eth_requestAccounts") {
                return [crossmintWallet.address];
              }
              if (method === "eth_chainId") {
                return `0x${chain.id.toString(16)}`;
              }
              throw new Error(`Method ${method} not yet supported with Crossmint wallet adapter`);
            },
          }),
        });
      } catch (e) {
        console.error("Failed to create wallet client from Crossmint:", e);
      }
    }
    return wagmiWalletClient ?? undefined;
  }, [crossmintWallet, wagmiWalletClient]);
}
