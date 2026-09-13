"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useHealthAlerts } from "@/hooks/useHealthAlerts";

interface HealthAlertToastProps {
  onTopUpCollateral?: () => void;
}

/**
 * Monitors health alerts and fires sonner toasts for new threshold breaches.
 * Danger alerts include a "Top Up Collateral" action button that triggers
 * the Coinbase onramp modal (One-Click Top Up flow).
 */
export function HealthAlertToast({ onTopUpCollateral }: HealthAlertToastProps) {
  const { alerts, acknowledge } = useHealthAlerts();
  const shownAlerts = useRef(new Set<string>());

  useEffect(() => {
    for (const alert of alerts) {
      // Only show each alert once per session
      if (shownAlerts.current.has(alert.id)) continue;
      shownAlerts.current.add(alert.id);

      if (alert.alert_type === "danger" || alert.current_status === "liquidated") {
        toast.error("Liquidation Risk!", {
          description: alert.message,
          duration: Infinity, // Persistent until dismissed
          action: onTopUpCollateral
            ? {
                label: "Top Up Collateral",
                onClick: () => {
                  acknowledge(alert.id);
                  onTopUpCollateral();
                },
              }
            : undefined,
          cancel: {
            label: "Dismiss",
            onClick: () => acknowledge(alert.id),
          },
        });
      } else if (alert.alert_type === "warning") {
        toast.warning("Health Factor Warning", {
          description: alert.message,
          duration: 15000, // 15 seconds
          action: {
            label: "Dismiss",
            onClick: () => acknowledge(alert.id),
          },
        });
      }
    }
  }, [alerts, acknowledge, onTopUpCollateral]);

  return null; // Renders nothing — just fires toasts
}
