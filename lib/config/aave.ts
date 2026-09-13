import { chainId } from "@aave/react";

import { appChain } from "@/lib/wagmiConfig";

export const AAVE_TARGET_CHAIN_ID = chainId(appChain.id);
export const USDC_DECIMALS = 6;
export const USDC_SYMBOL = "USDC";
