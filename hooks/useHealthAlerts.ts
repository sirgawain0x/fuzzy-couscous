"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/context/AuthContext";

interface HealthAlert {
  id: string;
  alert_type: "warning" | "danger";
  previous_status: string | null;
  current_status: string;
  health_factor: number;
  message: string;
  created_at: string;
}

/**
 * Polls for unacknowledged health alerts every 60 seconds.
 * Returns alert data and an acknowledge function.
 */
export function useHealthAlerts() {
  const { wallet } = useWallet();
  const { sessionToken } = useAuth();
  const queryClient = useQueryClient();
  const walletAddress = wallet?.address;

  const { data, isLoading } = useQuery<{ alerts: HealthAlert[] }>({
    queryKey: ["health-alerts", walletAddress, sessionToken],
    queryFn: async () => {
      if (!walletAddress || !sessionToken) return { alerts: [] };
      const response = await fetch("/api/alerts", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) return { alerts: [] };
      return response.json();
    },
    enabled: !!walletAddress && !!sessionToken,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const acknowledge = useCallback(
    async (alertId: string) => {
      if (!sessionToken) return;
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ alertId }),
      });
      queryClient.invalidateQueries({
        queryKey: ["health-alerts", walletAddress, sessionToken],
      });
    },
    [walletAddress, sessionToken, queryClient]
  );

  const alerts = data?.alerts ?? [];
  const hasUnacknowledged = alerts.length > 0;

  return { alerts, hasUnacknowledged, acknowledge, isLoading };
}
