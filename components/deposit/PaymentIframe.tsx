"use client";

import { useEffect, useRef, useState } from "react";
import { PrimaryButton } from "@/components/common/PrimaryButton";

interface PaymentIframeProps {
  paymentUrl: string;
  onPaymentComplete: () => void;
  onPaymentFailed: () => void;
}

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

/**
 * Renders the Coinbase payment link.
 * - Production: iframe with Apple Pay / Google Pay
 * - Localhost: opens in a new tab (Coinbase blocks iframe on localhost)
 */
export function PaymentIframe({
  paymentUrl,
  onPaymentComplete,
  onPaymentFailed,
}: PaymentIframeProps) {
  const handlerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const [tabOpened, setTabOpened] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://pay.coinbase.com") return;

      const isSuccess =
        event.data?.type === "payment-success" ||
        event.data?.type === "payment-completed" ||
        event.data?.status === "success" ||
        event.data?.status === "completed" ||
        event.data?.event === "purchase-success" ||
        event.data?.event === "purchase-completed" ||
        event.data?.event === "onramp_purchase_success" ||
        event.data?.event === "onramp_purchase_completed";

      const isFailed =
        event.data?.type === "payment-error" ||
        event.data?.type === "payment-cancelled" ||
        event.data?.type === "payment-canceled" ||
        event.data?.status === "error" ||
        event.data?.status === "failed" ||
        event.data?.status === "cancelled" ||
        event.data?.status === "canceled";

      if (isSuccess) {
        onPaymentComplete();
      } else if (isFailed) {
        onPaymentFailed();
      }
    };

    handlerRef.current = handleMessage;
    window.addEventListener("message", handleMessage);

    return () => {
      if (handlerRef.current) {
        window.removeEventListener("message", handlerRef.current);
      }
    };
  }, [onPaymentComplete, onPaymentFailed]);

  // Localhost: open in new tab since Coinbase blocks iframe embedding
  if (isLocalhost) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-gray-900">
          Coinbase payment cannot be embedded on localhost. Complete your payment in a new tab.
        </p>
        {!tabOpened ? (
          <PrimaryButton
            onClick={() => {
              window.open(paymentUrl, "_blank", "noopener,noreferrer");
              setTabOpened(true);
            }}
          >
            Open Payment Page
          </PrimaryButton>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-900">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-900" />
              Waiting for payment...
            </div>
            <button onClick={onPaymentComplete} className="text-xs text-blue-700 underline">
              I completed the payment
            </button>
            <button onClick={onPaymentFailed} className="text-xs text-gray-900 underline">
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  // Production: embedded iframe
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-xs text-gray-900">
        Complete your payment below. If you don&apos;t see a Pay button, scan the QR code with your
        phone.
      </p>
      <iframe
        src={paymentUrl}
        allow="payment"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        className="h-[500px] w-full rounded-lg border-0"
        title="Coinbase Payment"
      />
    </div>
  );
}
