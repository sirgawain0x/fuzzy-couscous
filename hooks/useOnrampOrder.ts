"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type OnrampOrderStatus =
  | "PENDING_AUTH"
  | "PENDING_PAYMENT"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

interface OnrampQuote {
  paymentTotal: string;
  paymentSubtotal: string;
  purchaseAmount: string;
  exchangeRate: string;
  fees: Array<{ type: string; amount: string; currency: string }>;
}

interface OnrampOrder {
  orderId: string;
  status: OnrampOrderStatus;
  paymentLink?: { url: string; paymentLinkType: string };
  paymentTotal?: string;
  purchaseAmount?: string;
}

interface UseOnrampOrderReturn {
  quote: OnrampQuote | null;
  order: OnrampOrder | null;
  isLoadingQuote: boolean;
  isCreatingOrder: boolean;
  isPolling: boolean;
  error: string | null;
  fetchQuote: (params: FetchQuoteParams) => Promise<void>;
  createOrder: (params: CreateOrderParams) => Promise<void>;
  reset: () => void;
}

interface FetchQuoteParams {
  paymentAmount: string;
  destinationAddress: string;
  phoneNumber: string;
  email: string;
  agreementAcceptedAt: string;
  phoneNumberVerifiedAt?: string;
  paymentMethod?: string;
}

interface CreateOrderParams {
  paymentAmount: string;
  destinationAddress: string;
  phoneNumber: string;
  email: string;
  agreementAcceptedAt: string;
  phoneNumberVerifiedAt?: string;
  paymentMethod?: string;
  sessionToken?: string;
  authToken?: string;
}

// Re-export for use in components
export type { FetchQuoteParams, CreateOrderParams };

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100; // ~5 minutes

export function useOnrampOrder(): UseOnrampOrderReturn {
  const [quote, setQuote] = useState<OnrampQuote | null>(null);
  const [order, setOrder] = useState<OnrampOrder | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const fetchQuote = useCallback(async (params: FetchQuoteParams) => {
    setIsLoadingQuote(true);
    setError(null);

    try {
      const response = await fetch("/api/onramp/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch quote");
      }

      const data = await response.json();
      setQuote(data.order || data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch quote");
    } finally {
      setIsLoadingQuote(false);
    }
  }, []);

  const pollOrderStatus = useCallback((orderId: string) => {
    setIsPolling(true);
    pollCountRef.current = 0;

    pollIntervalRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setIsPolling(false);
        setError("Order timed out. Please check your account for the transaction status.");
        return;
      }

      try {
        const response = await fetch(`/api/onramp/order/${orderId}`);
        if (!response.ok) return;

        const data = await response.json();
        const status = data.order?.status || data.status;

        setOrder((prev) => (prev ? { ...prev, status } : prev));

        if (status === "COMPLETED" || status === "FAILED") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setIsPolling(false);
        }
      } catch {
        // Retry on next interval
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const createOrder = useCallback(
    async (params: CreateOrderParams) => {
      setIsCreatingOrder(true);
      setError(null);

      try {
        const domain = typeof window !== "undefined" ? window.location.hostname : undefined;

        const authToken = params.authToken ?? params.sessionToken;
        const response = await fetch("/api/onramp/order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            ...params,
            partnerUserRef: params.destinationAddress,
            domain,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create order");
        }

        const data = await response.json();
        const newOrder: OnrampOrder = {
          orderId: data.order?.orderId || data.orderId,
          status: data.order?.status || "PENDING_PAYMENT",
          paymentLink: data.paymentLink,
          paymentTotal: data.order?.paymentTotal,
          purchaseAmount: data.order?.purchaseAmount,
        };

        setOrder(newOrder);

        // Start polling for order status
        if (newOrder.orderId) {
          pollOrderStatus(newOrder.orderId);
        }
      } catch (err: any) {
        setError(err.message || "Failed to create order");
      } finally {
        setIsCreatingOrder(false);
      }
    },
    [pollOrderStatus]
  );

  const reset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setQuote(null);
    setOrder(null);
    setIsLoadingQuote(false);
    setIsCreatingOrder(false);
    setIsPolling(false);
    setError(null);
    pollCountRef.current = 0;
  }, []);

  return {
    quote,
    order,
    isLoadingQuote,
    isCreatingOrder,
    isPolling,
    error,
    fetchQuote,
    createOrder,
    reset,
  };
}
