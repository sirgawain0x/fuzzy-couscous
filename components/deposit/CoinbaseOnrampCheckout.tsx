"use client";

import { useState, useEffect, useRef } from "react";
import { PrimaryButton } from "../common/PrimaryButton";
import createCoinbaseSessionToken from "@/server-actions/createCoinbaseSessionToken";
import { showTxErrorToast, showTxSuccessToast } from "@/lib/transactionToast";

export type CoinbaseOnrampCheckoutProps = {
  amount: string;
  walletAddress: string;
  onPaymentCompleted: () => void;
  onProcessingPayment: () => void;
  isAmountValid: boolean;
  step: "options" | "processing" | "completed";
  goBack: () => void;
  receiptEmail?: string;
  MAX_AMOUNT: number;
};

export function CoinbaseOnrampCheckout({
  amount,
  walletAddress,
  onPaymentCompleted,
  onProcessingPayment,
  isAmountValid,
  step,
  goBack, // Reserved for future use - parent manages navigation
  receiptEmail, // Reserved for future use - not required for Coinbase onramp
  MAX_AMOUNT,
}: CoinbaseOnrampCheckoutProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const paymentInitiatedRef = useRef<boolean>(false);
  const paymentCompletedRef = useRef<boolean>(false);
  const popupOpenTimeRef = useRef<number | null>(null);
  const paymentInitiationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const popupCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (paymentInitiationTimeoutRef.current) {
        clearTimeout(paymentInitiationTimeoutRef.current);
      }
      if (popupCloseTimeoutRef.current) {
        clearTimeout(popupCloseTimeoutRef.current);
      }
      if (messageHandlerRef.current) {
        window.removeEventListener("message", messageHandlerRef.current);
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      // Reset all flags on unmount
      paymentInitiatedRef.current = false;
      paymentCompletedRef.current = false;
      popupOpenTimeRef.current = null;
    };
  }, []);

  const handleOpenOnramp = async () => {
    setError(null);
    setLoading(true);

    // Clean up any existing intervals and listeners before starting a new session
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (paymentInitiationTimeoutRef.current) {
      clearTimeout(paymentInitiationTimeoutRef.current);
      paymentInitiationTimeoutRef.current = null;
    }
    if (popupCloseTimeoutRef.current) {
      clearTimeout(popupCloseTimeoutRef.current);
      popupCloseTimeoutRef.current = null;
    }
    if (messageHandlerRef.current) {
      window.removeEventListener("message", messageHandlerRef.current);
      messageHandlerRef.current = null;
    }

    // Reset flags for new session
    paymentInitiatedRef.current = false;
    paymentCompletedRef.current = false;
    popupOpenTimeRef.current = null;

    try {
      // Generate session token
      const token = await createCoinbaseSessionToken({
        address: walletAddress,
        blockchains: ["base"],
        assets: ["USDC"],
      });

      if (!token) {
        throw new Error("Failed to generate session token");
      }

      // Build onramp URL with one-click-buy parameters
      const params = new URLSearchParams({
        sessionToken: token,
        defaultNetwork: "base",
        defaultAsset: "USDC",
        presetFiatAmount: amount,
        fiatCurrency: "USD",
      });

      const onrampUrl = `https://pay.coinbase.com/buy/select-asset?${params.toString()}`;

      // Open popup window
      const width = 500;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      popupRef.current = window.open(
        onrampUrl,
        "Coinbase Onramp",
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popupRef.current) {
        throw new Error("Popup blocked. Please allow popups for this site.");
      }

      // Track when popup was opened
      popupOpenTimeRef.current = Date.now();

      // If popup stays open for more than 5 seconds, assume user is interacting
      // and payment might be initiated (heuristic for when Coinbase doesn't send messages)
      paymentInitiationTimeoutRef.current = setTimeout(() => {
        if (popupRef.current && !popupRef.current.closed) {
          paymentInitiatedRef.current = true;
        }
      }, 5000); // 5 seconds

      // Monitor popup for close events
      const checkPopupClosed = setInterval(() => {
        if (popupRef.current?.closed) {
          clearInterval(checkPopupClosed);
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }

          // Clear payment initiation timeout if popup closes
          if (paymentInitiationTimeoutRef.current) {
            clearTimeout(paymentInitiationTimeoutRef.current);
            paymentInitiationTimeoutRef.current = null;
          }

          // Clear any existing popup close timeout before creating a new one
          if (popupCloseTimeoutRef.current) {
            clearTimeout(popupCloseTimeoutRef.current);
            popupCloseTimeoutRef.current = null;
          }

          // Give a small delay to allow any pending success messages to arrive
          // This handles the case where popup closes right after payment completes
          popupCloseTimeoutRef.current = setTimeout(() => {
            // Clear the ref since timeout is executing
            popupCloseTimeoutRef.current = null;

            // If payment was already completed via message, don't do anything
            // (the message handler already called onPaymentCompleted)
            if (paymentCompletedRef.current) {
              return;
            }

            // User closed popup without completing payment - always reset to options.
            // We never transition to processing on close; only explicit postMessage
            // (payment-initiated) in the message handler can show "Processing payment...".
            if (messageHandlerRef.current) {
              window.removeEventListener("message", messageHandlerRef.current);
              messageHandlerRef.current = null;
            }
            paymentInitiatedRef.current = false;
            paymentCompletedRef.current = false;
            popupOpenTimeRef.current = null;
            goBack();
          }, 500); // 500ms delay to catch late-arriving messages
        }
      }, 1000);

      // Store interval for cleanup
      checkIntervalRef.current = checkPopupClosed;

      // Listen for messages from popup (if Coinbase sends postMessage events)
      const handleMessage = (event: MessageEvent) => {
        // Only accept messages from Coinbase domain
        if (event.origin !== "https://pay.coinbase.com") {
          return;
        }

        // Handle payment initiation events - show "Processing payment..." when we have explicit proof
        if (
          event.data?.type === "payment-initiated" ||
          event.data?.type === "payment-started" ||
          event.data?.type === "onramp-purchase-started" ||
          event.data?.status === "initiated" ||
          event.data?.status === "started" ||
          event.data?.event === "purchase-started"
        ) {
          paymentInitiatedRef.current = true;
          onProcessingPayment();
          return;
        }

        // Handle payment completion events - check multiple possible formats
        const isSuccess =
          event.data?.type === "payment-success" ||
          event.data?.type === "payment-completed" ||
          event.data?.type === "onramp-purchase-success" ||
          event.data?.type === "onramp-purchase-completed" ||
          event.data?.status === "success" ||
          event.data?.status === "completed" ||
          event.data?.event === "purchase-success" ||
          event.data?.event === "purchase-completed" ||
          event.data?.event === "onramp_purchase_success" ||
          event.data?.event === "onramp_purchase_completed";

        if (isSuccess) {
          // Mark payment as completed to prevent popup close handler from overriding
          paymentCompletedRef.current = true;

          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          if (paymentInitiationTimeoutRef.current) {
            clearTimeout(paymentInitiationTimeoutRef.current);
            paymentInitiationTimeoutRef.current = null;
          }
          if (popupCloseTimeoutRef.current) {
            clearTimeout(popupCloseTimeoutRef.current);
            popupCloseTimeoutRef.current = null;
          }
          if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
          }
          if (messageHandlerRef.current) {
            window.removeEventListener("message", messageHandlerRef.current);
            messageHandlerRef.current = null;
          }
          paymentInitiatedRef.current = false;
          popupOpenTimeRef.current = null;
          showTxSuccessToast({
            title: "Deposit complete",
            description: amount
              ? `$${Number(amount).toFixed(2)} USDC is on its way to your wallet.`
              : "Your USDC is on its way to your wallet.",
          });
          onPaymentCompleted();
          return;
        }

        // Handle payment cancellation/error events
        const isCancelled =
          event.data?.type === "payment-cancelled" ||
          event.data?.type === "payment-canceled" ||
          event.data?.type === "payment-error" ||
          event.data?.type === "onramp-purchase-cancelled" ||
          event.data?.type === "onramp-purchase-canceled" ||
          event.data?.status === "cancelled" ||
          event.data?.status === "canceled" ||
          event.data?.status === "error" ||
          event.data?.status === "failed" ||
          event.data?.event === "purchase-cancelled" ||
          event.data?.event === "purchase-canceled" ||
          event.data?.event === "onramp_purchase_cancelled";

        if (isCancelled) {
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          if (paymentInitiationTimeoutRef.current) {
            clearTimeout(paymentInitiationTimeoutRef.current);
            paymentInitiationTimeoutRef.current = null;
          }
          if (popupCloseTimeoutRef.current) {
            clearTimeout(popupCloseTimeoutRef.current);
            popupCloseTimeoutRef.current = null;
          }
          if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
          }
          if (messageHandlerRef.current) {
            window.removeEventListener("message", messageHandlerRef.current);
            messageHandlerRef.current = null;
          }
          paymentInitiatedRef.current = false;
          paymentCompletedRef.current = false;
          popupOpenTimeRef.current = null;
          showTxErrorToast({
            title: "Payment cancelled",
            description: "Payment failed or was cancelled.",
          });
          // Reset to options when payment is cancelled
          goBack();
          return;
        }
      };

      messageHandlerRef.current = handleMessage;
      window.addEventListener("message", handleMessage);

      setLoading(false);
    } catch (err: any) {
      // Clean up intervals and listeners on error
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (paymentInitiationTimeoutRef.current) {
        clearTimeout(paymentInitiationTimeoutRef.current);
        paymentInitiationTimeoutRef.current = null;
      }
      if (popupCloseTimeoutRef.current) {
        clearTimeout(popupCloseTimeoutRef.current);
        popupCloseTimeoutRef.current = null;
      }
      if (messageHandlerRef.current) {
        window.removeEventListener("message", messageHandlerRef.current);
        messageHandlerRef.current = null;
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      paymentInitiatedRef.current = false;
      paymentCompletedRef.current = false;
      popupOpenTimeRef.current = null;
      setError(err.message || "Failed to start Coinbase onramp. Please try again.");
      setLoading(false);
    }
  };

  // Don't render button if already processing or completed
  if (step === "processing") {
    return (
      <div className="flex w-full flex-col items-center justify-center space-y-4">
        <div className="flex items-center space-x-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          <span className="text-sm text-gray-500">Processing payment...</span>
        </div>
      </div>
    );
  }

  if (step === "completed") {
    return (
      <div className="flex w-full flex-col items-center justify-center space-y-4">
        <div className="text-sm text-green-600">Payment completed successfully!</div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center justify-center gap-4">
      {receiptEmail && (
        <p className="text-center text-sm text-gray-600">
          Using your sign-in email <span className="font-medium text-black">{receiptEmail}</span>.
          Coinbase will handle identity verification in their secure checkout — no extra steps here.
        </p>
      )}
      {error && <div className="text-center text-sm text-red-500">{error}</div>}
      <PrimaryButton onClick={handleOpenOnramp} disabled={loading || !isAmountValid}>
        {loading ? "Opening Coinbase..." : "Continue to Coinbase"}
      </PrimaryButton>
      {!isAmountValid && (
        <div className="text-center text-xs text-red-500">
          Please enter a valid amount between $1 and ${MAX_AMOUNT.toLocaleString()}
        </div>
      )}
    </div>
  );
}
