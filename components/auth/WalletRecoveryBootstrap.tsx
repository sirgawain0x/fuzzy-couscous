"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@crossmint/client-sdk-react-ui";

/**
 * Runs preemptive wallet recovery after login so OTP verification happens on
 * load instead of interrupting the user's first transaction.
 */
export const WalletRecoveryBootstrap = () => {
  const { wallet, status: walletStatus } = useWallet();
  const [isRecovering, setIsRecovering] = useState(false);
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    if (walletStatus !== "loaded" || !wallet) {
      hasAttemptedRef.current = false;
      return;
    }

    if (hasAttemptedRef.current) return;

    const runPreemptiveRecovery = async () => {
      hasAttemptedRef.current = true;

      try {
        await wallet.waitForInit();

        if (!wallet.needsRecovery()) return;

        setIsRecovering(true);
        await wallet.recover();
      } catch {
        // Best-effort upfront recovery; the SDK still recovers before the first tx.
      } finally {
        setIsRecovering(false);
      }
    };

    void runPreemptiveRecovery();
  }, [wallet, walletStatus]);

  if (!isRecovering) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Setting up wallet on this device"
      className="bg-background/95 text-foreground fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 border-b px-4 py-3 text-sm shadow-md backdrop-blur-sm"
    >
      <div
        className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
        aria-hidden="true"
      />
      <span>Verifying your identity to set up this device…</span>
    </div>
  );
};
