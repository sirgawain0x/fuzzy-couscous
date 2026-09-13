import { type Address, erc20Abi, formatUnits } from "viem";
import { base, baseSepolia } from "viem/chains";

import { appChain } from "@/lib/wagmiConfig";

const DEFAULT_BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const DEFAULT_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;

export const USDC_DECIMALS = 6;

export const getUsdcAddress = (): Address => {
  const configured = process.env.NEXT_PUBLIC_USDC_MINT as Address | undefined;
  if (configured) return configured;
  return appChain.id === base.id ? DEFAULT_BASE_USDC : DEFAULT_SEPOLIA_USDC;
};

export const getUsdcExplorerUrl = (txHash: string): string => {
  const baseUrl =
    appChain.id === baseSepolia.id ? "https://sepolia.basescan.org" : "https://basescan.org";
  return `${baseUrl}/tx/${txHash}`;
};

export { erc20Abi, formatUnits };
