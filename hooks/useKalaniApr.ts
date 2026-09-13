import { useCallback, useEffect, useState } from "react";

import { isBaseMainnet } from "@/lib/wagmiConfig";

type KalaniAprResponse =
  | {
      aprPercent: number;
      error?: undefined;
    }
  | {
      aprPercent?: undefined;
      error: string;
    };

type KalaniAprState = {
  loading: boolean;
  aprPercent?: number;
  error?: string;
};

export function useKalaniApr() {
  const [state, setState] = useState<KalaniAprState>({ loading: true });

  const fetchApr = useCallback(async () => {
    if (!isBaseMainnet) {
      setState({
        loading: false,
        error: "APR oracle available on Base mainnet only.",
      });
      return;
    }

    setState({ loading: true });

    try {
      const response = await fetch("/api/kalani-apr", { cache: "no-store" });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => ({}))) as KalaniAprResponse;
        const message = errorPayload?.error ?? "Unable to load Kalani APR.";
        setState({ loading: false, error: message });
        return;
      }

      const data = (await response.json()) as KalaniAprResponse;

      if (typeof data.aprPercent !== "number") {
        setState({
          loading: false,
          error: data.error ?? "APR oracle returned an invalid response.",
        });
        return;
      }

      setState({
        loading: false,
        aprPercent: data.aprPercent,
      });
    } catch (error) {
      console.error("Kalani APR oracle read failed", error);
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Unknown oracle error",
      });
    }
  }, []);

  useEffect(() => {
    void fetchApr();
  }, [fetchApr]);

  return {
    apr: state.aprPercent,
    loading: state.loading,
    error: state.error,
    refetch: fetchApr,
  };
}
