"use client";

import { type Address, encodeFunctionData, parseUnits } from "viem";
import type { WalletClient } from "viem";

import { USDC_DECIMALS, erc20Abi, getUsdcAddress, getUsdcExplorerUrl } from "@/lib/usdc";

export type UsdcSendResult = {
  hash: string;
  explorerLink: string;
};

const resolveRecipientAddress = async (
  recipient: string | { email: string }
): Promise<Address> => {
  if (typeof recipient === "string") {
    if (!recipient.startsWith("0x") || recipient.length !== 42) {
      throw new Error("Invalid wallet address");
    }
    return recipient as Address;
  }

  throw new Error(
    "Sending USDC by email is not supported with Privy wallets. Enter the recipient's wallet address instead."
  );
};

export const sendUsdc = async (
  walletClient: WalletClient,
  fromAddress: Address,
  recipient: string | { email: string },
  amount: string
): Promise<UsdcSendResult> => {
  const to = await resolveRecipientAddress(recipient);
  const usdc = getUsdcAddress();
  const value = parseUnits(amount, USDC_DECIMALS);

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, value],
  });

  const hash = await walletClient.sendTransaction({
    account: fromAddress,
    to: usdc,
    data,
    chain: walletClient.chain,
  });

  return {
    hash,
    explorerLink: getUsdcExplorerUrl(hash),
  };
};
