"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useOnrampOrder } from "@/hooks/useOnrampOrder";
import { TermsAcceptance } from "./TermsAcceptance";
import { OnrampQuoteDisplay } from "./OnrampQuoteDisplay";
import { PaymentIframe } from "./PaymentIframe";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { OTPVerification } from "@/components/auth/OTPVerification";
import { isVerificationFresh } from "@/lib/verificationFreshness";
import { showTxErrorToast, showTxSuccessToast } from "@/lib/transactionToast";

type HeadlessStep =
  | "idle"
  | "phone-input"
  | "phone-otp"
  | "terms"
  | "quote"
  | "payment"
  | "polling"
  | "completed"
  | "failed";

interface HeadlessOnrampFlowProps {
  amount: string;
  walletAddress: string;
  onPaymentCompleted: () => void;
  onProcessingPayment: () => void;
  isAmountValid: boolean;
  step: "options" | "processing" | "completed";
  goBack: () => void;
  receiptEmail?: string;
  MAX_AMOUNT: number;
}

export function HeadlessOnrampFlow({
  amount,
  walletAddress,
  onPaymentCompleted,
  onProcessingPayment,
  isAmountValid,
  step: parentStep,
  receiptEmail,
}: HeadlessOnrampFlowProps) {
  const { user, jwt, refreshUserProfile } = useAuth();
  const {
    quote,
    order,
    isLoadingQuote,
    isCreatingOrder,
    isPolling,
    error: orderError,
    fetchQuote,
    createOrder,
    reset: resetOrder,
  } = useOnrampOrder();

  const [headlessStep, setHeadlessStep] = useState<HeadlessStep>("idle");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? "");
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState<string | null>(
    user?.phoneNumberVerifiedAt || null
  );
  const [agreementAcceptedAt, setAgreementAcceptedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOtpLoading, setIsOtpLoading] = useState(false);

  const email = receiptEmail || user?.email || "";

  const paymentMethod =
    typeof window !== "undefined" &&
    /Safari/.test(navigator.userAgent) &&
    !/Chrome/.test(navigator.userAgent)
      ? "GUEST_CHECKOUT_APPLE_PAY"
      : "GUEST_CHECKOUT_GOOGLE_PAY";

  const hasVerifiedEmail = Boolean(email);
  const hasWarmStartPhone = !!(
    user?.phoneNumber && isVerificationFresh(user.phoneNumberVerifiedAt ?? phoneVerifiedAt)
  );

  const handleStartFlow = useCallback(async () => {
    if (!hasVerifiedEmail) {
      setError(
        "Sign in with email to use Express Checkout, or choose All Payment Methods instead."
      );
      return;
    }
    if (hasWarmStartPhone && user?.phoneNumber) {
      setPhoneNumber(user.phoneNumber);
      setPhoneVerifiedAt(user.phoneNumberVerifiedAt ?? phoneVerifiedAt);
      setHeadlessStep("terms");
      return;
    }
    setHeadlessStep("phone-input");
  }, [hasVerifiedEmail, hasWarmStartPhone, user, phoneVerifiedAt]);

  const handleSendPhoneOTP = async () => {
    if (!phoneNumber.trim() || !jwt) return;
    setError(null);
    setIsOtpLoading(true);

    try {
      const response = await fetch("/api/user/phone/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      setHeadlessStep("phone-otp");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send verification code";
      setError(message);
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleVerifyPhoneOTP = async (code: string) => {
    if (!jwt) return;

    const response = await fetch("/api/user/phone/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ phoneNumber: phoneNumber.trim(), code }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Invalid verification code");
    }

    setPhoneVerifiedAt(data.phoneNumberVerifiedAt);
    await refreshUserProfile();
    setHeadlessStep("terms");
  };

  const handleResendPhoneOTP = async () => {
    await handleSendPhoneOTP();
  };

  const handleTermsAccepted = async (timestamp: string) => {
    setAgreementAcceptedAt(timestamp);
    await fetchQuote({
      paymentAmount: amount,
      destinationAddress: walletAddress,
      phoneNumber,
      email,
      agreementAcceptedAt: timestamp,
      phoneNumberVerifiedAt: phoneVerifiedAt || undefined,
      paymentMethod,
    });
    setHeadlessStep("quote");
  };

  const quoteIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (headlessStep === "quote" && agreementAcceptedAt && phoneVerifiedAt) {
      quoteIntervalRef.current = setInterval(() => {
        fetchQuote({
          paymentAmount: amount,
          destinationAddress: walletAddress,
          phoneNumber,
          email,
          agreementAcceptedAt,
          phoneNumberVerifiedAt: phoneVerifiedAt || undefined,
          paymentMethod,
        });
      }, 15000);

      return () => {
        if (quoteIntervalRef.current) {
          clearInterval(quoteIntervalRef.current);
          quoteIntervalRef.current = null;
        }
      };
    }
  }, [
    headlessStep,
    amount,
    walletAddress,
    phoneNumber,
    email,
    agreementAcceptedAt,
    phoneVerifiedAt,
    fetchQuote,
    paymentMethod,
  ]);

  const handleConfirmQuote = async () => {
    if (!agreementAcceptedAt || !phoneVerifiedAt || !jwt) return;

    await createOrder({
      paymentAmount: amount,
      destinationAddress: walletAddress,
      phoneNumber,
      email,
      agreementAcceptedAt,
      phoneNumberVerifiedAt: phoneVerifiedAt,
      authToken: jwt,
      paymentMethod,
    });

    setHeadlessStep("payment");
    onProcessingPayment();
  };

  const handlePaymentComplete = () => {
    setHeadlessStep("completed");
    showTxSuccessToast({
      title: "Deposit complete",
      description: amount
        ? `$${Number(amount).toFixed(2)} USDC is on its way to your wallet.`
        : "Your USDC is on its way to your wallet.",
    });
    onPaymentCompleted();
  };

  const handlePaymentFailed = () => {
    setHeadlessStep("failed");
    showTxErrorToast({
      title: "Payment failed",
      description: "Payment failed or was cancelled.",
    });
  };

  const handleReset = () => {
    setHeadlessStep("idle");
    setPhoneNumber(user?.phoneNumber ?? "");
    setPhoneVerifiedAt(user?.phoneNumberVerifiedAt || null);
    setAgreementAcceptedAt(null);
    setError(null);
    resetOrder();
  };

  if (parentStep === "processing" && headlessStep !== "payment") {
    return (
      <div className="flex w-full flex-col items-center justify-center space-y-4">
        <div className="flex items-center space-x-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-900" />
          <span className="text-sm text-gray-900">Processing payment...</span>
        </div>
      </div>
    );
  }

  if (parentStep === "completed") {
    return (
      <div className="flex w-full flex-col items-center justify-center space-y-4">
        <div className="text-sm text-black">Payment completed successfully!</div>
      </div>
    );
  }

  if (parentStep === "options" && headlessStep === "idle") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4">
        <p className="text-center text-xs text-gray-600">
          Email <span className="font-medium text-black">{email}</span> is verified from your
          sign-in. Express Checkout also requires a verified US mobile number.
        </p>
        {(error || orderError) && (
          <div className="text-center text-sm text-red-600">{error || orderError}</div>
        )}
        <PrimaryButton onClick={handleStartFlow} disabled={!isAmountValid || !hasVerifiedEmail}>
          {hasWarmStartPhone ? "Continue to Deposit" : "Verify phone & continue"}
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {(error || orderError) && (
        <div className="text-center text-sm text-red-500">{error || orderError}</div>
      )}

      {headlessStep === "phone-input" && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-center text-sm text-gray-900">
            Coinbase requires a verified phone number for identity verification.
          </p>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendPhoneOTP()}
            placeholder="+1 (555) 555-5555"
            autoFocus
            className="w-full rounded-md border border-gray-600 bg-gray-300 px-4 py-3 text-sm text-black placeholder:text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <p className="text-center text-xs text-gray-900">
            Enter your phone number in E.164 format (e.g., +12025551234)
          </p>
          <PrimaryButton
            onClick={handleSendPhoneOTP}
            disabled={!phoneNumber.trim() || isOtpLoading || !jwt}
          >
            {isOtpLoading ? "Sending..." : "Send Verification Code"}
          </PrimaryButton>
        </div>
      )}

      {headlessStep === "phone-otp" && (
        <OTPVerification
          type="phone"
          destination={phoneNumber}
          onVerify={handleVerifyPhoneOTP}
          onResend={handleResendPhoneOTP}
          error={error}
          isVerifying={isOtpLoading}
        />
      )}

      {headlessStep === "terms" && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-xs text-gray-600">
            Depositing as <span className="font-medium text-black">{email}</span>
            {phoneNumber ? (
              <>
                {" "}
                · Phone <span className="font-medium text-black">{phoneNumber}</span>
              </>
            ) : null}
          </p>
          <TermsAcceptance onAccept={handleTermsAccepted} isLoading={isLoadingQuote} />
        </div>
      )}

      {headlessStep === "quote" && quote && (
        <OnrampQuoteDisplay
          paymentAmount={amount}
          purchaseAmount={quote.purchaseAmount}
          exchangeRate={quote.exchangeRate}
          fees={quote.fees}
          paymentCurrency="USD"
          purchaseCurrency="USDC"
          onConfirm={handleConfirmQuote}
          onRefresh={() =>
            fetchQuote({
              paymentAmount: amount,
              destinationAddress: walletAddress,
              phoneNumber,
              email,
              agreementAcceptedAt: agreementAcceptedAt!,
              phoneNumberVerifiedAt: phoneVerifiedAt || undefined,
              paymentMethod,
            })
          }
          isLoading={isCreatingOrder || isLoadingQuote}
        />
      )}

      {headlessStep === "payment" && order?.paymentLink?.url && (
        <PaymentIframe
          paymentUrl={order.paymentLink.url}
          onPaymentComplete={handlePaymentComplete}
          onPaymentFailed={handlePaymentFailed}
        />
      )}

      {headlessStep === "payment" && isPolling && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-900">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-900" />
          Waiting for payment confirmation...
        </div>
      )}

      {headlessStep === "completed" && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-sm font-medium text-black">Payment completed successfully!</div>
          <p className="text-center text-xs text-gray-900">
            Your USDC will arrive in your wallet shortly.
          </p>
        </div>
      )}

      {headlessStep === "failed" && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-sm font-medium text-red-600">Payment failed or was cancelled.</div>
          <PrimaryButton onClick={handleReset}>Try Again</PrimaryButton>
        </div>
      )}
    </div>
  );
}
