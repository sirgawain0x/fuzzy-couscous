"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { type Address, formatUnits } from "viem";

import { sendUsdc, type UsdcSendResult } from "@/lib/sendUsdc";
import { USDC_DECIMALS, erc20Abi, getUsdcAddress } from "@/lib/usdc";

export type AppWalletStatus = "loaded" | "not-loaded" | "in-progress" | "error";

export type AppWallet = {
  address: string;
  send: (
    recipient: string | { email: string },
    token: "usdc",
    amount: string
  ) => Promise<UsdcSendResult>;
  balances: (tokens: Array<"usdc">) => Promise<{ usdc?: { amount: string } }>;
};

type UseAppWalletResult = {
  wallet: AppWallet | null;
  status: AppWalletStatus;
  address: string | undefined;
};

export const useAppWallet = (): UseAppWalletResult => {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { address: wagmiAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const embeddedWallet = useMemo(
    () => wallets.find((wallet) => wallet.walletClientType === "privy"),
    [wallets]
  );

  useEffect(() => {
    if (!embeddedWallet || wagmiAddress === embeddedWallet.address) return;
    void setActiveWallet(embeddedWallet);
  }, [embeddedWallet, wagmiAddress, setActiveWallet]);

  const address = embeddedWallet?.address ?? wagmiAddress;

  const balances = useCallback(
    async (tokens: Array<"usdc">) => {
      if (!address || !publicClient || !tokens.includes("usdc")) {
        return {};
      }

      const raw = await publicClient.readContract({
        address: getUsdcAddress(),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as Address],
      });

      return {
        usdc: {
          amount: formatUnits(raw, USDC_DECIMALS),
        },
      };
    },
    [address, publicClient]
  );

  const send = useCallback(
    async (
      recipient: string | { email: string },
      token: "usdc",
      amount: string
    ): Promise<UsdcSendResult> => {
      if (token !== "usdc") {
        throw new Error(`Unsupported token: ${token}`);
      }
      if (!walletClient || !address) {
        throw new Error("Wallet not connected");
      }

      return sendUsdc(walletClient, address as Address, recipient, amount);
    },
    [walletClient, address]
  );

  const wallet = useMemo((): AppWallet | null => {
    if (!address) return null;
    return { address, send, balances };
  }, [address, send, balances]);

  const status = useMemo((): AppWalletStatus => {
    if (!ready) return "in-progress";
    if (!authenticated) return "not-loaded";
    if (!address) return "in-progress";
    return "loaded";
  }, [ready, authenticated, address]);

  return { wallet, status, address };
};
