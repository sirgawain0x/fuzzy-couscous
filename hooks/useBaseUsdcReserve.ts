import { useMemo } from "react";
import { chainId as resolveChainId, useAaveMarkets, type Market, type Reserve } from "@aave/react";

import { appChain } from "@/lib/wagmiConfig";
import { USDC_SYMBOL } from "@/lib/config/aave";

type UseBaseUsdcReserveResult = {
  loading: boolean;
  error?: Error;
  market?: Market;
  reserve?: Reserve;
};

export function useBaseUsdcReserve(): UseBaseUsdcReserveResult {
  const {
    data: markets,
    loading,
    error,
  } = useAaveMarkets({
    chainIds: [resolveChainId(appChain.id)],
  });

  const { reserve, market } = useMemo(() => {
    if (!markets?.length) {
      return { reserve: undefined, market: undefined };
    }

    for (const marketItem of markets) {
      const reserves = marketItem.supplyReserves ?? [];
      const found = reserves.find(
        (item) => item.underlyingToken.symbol.toUpperCase() === USDC_SYMBOL
      );

      if (found) {
        return { reserve: found, market: marketItem };
      }
    }

    return { reserve: undefined, market: undefined };
  }, [markets]);

  return {
    loading,
    error: error ?? undefined,
    market,
    reserve,
  };
}
