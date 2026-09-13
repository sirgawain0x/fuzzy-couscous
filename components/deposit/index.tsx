import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { HeadlessOnrampFlow } from "./HeadlessOnrampFlow";
import { CoinbaseOnrampCheckout } from "./CoinbaseOnrampCheckout";
import { AmountInput } from "../common/AmountInput";
import { Modal } from "../common/Modal";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { cn } from "@/lib/utils";
import { useBalance } from "@/hooks/useBalance";

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
}

const MAX_AMOUNT = 100000;

type PaymentMethod = null | "digital-wallet" | "card";

export function DepositModal({ open, onClose, walletAddress }: DepositModalProps) {
  const [step, setStep] = useState<"options" | "processing" | "completed">("options");
  const { user } = useAuth();
  const receiptEmail = user?.email;
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const { refetch: refetchActivityFeed } = useActivityFeed();
  const { refetch: refetchBalance } = useBalance();

  const isAmountValid = Number(amount) <= MAX_AMOUNT && Number(amount) >= 1;

  const restartFlow = () => {
    setStep("options");
    setAmount("");
    setPaymentMethod(null);
  };

  useEffect(() => {
    if (open) {
      setStep("options");
      setAmount("");
      setPaymentMethod(null);
    }
  }, [open]);

  const handleDone = () => {
    restartFlow();
    onClose();
  };

  const handlePaymentCompleted = useCallback(() => {
    refetchActivityFeed();
    refetchBalance();
    handleDone();
  }, [refetchActivityFeed, refetchBalance, handleDone]);

  const handleProcessingPayment = useCallback(() => {
    setStep("processing");
  }, []);

  const handleBack = () => {
    if (paymentMethod) {
      setPaymentMethod(null);
    } else if (step === "options") {
      handleDone();
    } else {
      restartFlow();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      showBackButton={step !== "processing"}
      onBack={handleBack}
      showCloseButton={true}
      className={cn(
        "top-[70px] h-[calc(100dvh-174px)] md:max-h-[calc(100dvh-174px)] lg:top-0 lg:max-h-[calc(100dvh-32px)]",
        amount && "lg:min-h-[718px]"
      )}
      title="Deposit"
    >
      {step === "options" && !paymentMethod && (
        <div className="mb-6 flex w-full flex-col items-center">
          <AmountInput amount={amount} onChange={setAmount} />
          {amount && (Number(amount) < 1 || Number(amount) > MAX_AMOUNT) && (
            <div className="mt-2 text-center text-sm font-medium text-red-700">
              Please enter a valid amount between $1 and ${MAX_AMOUNT.toLocaleString()}
            </div>
          )}
        </div>
      )}

      {step === "options" && !paymentMethod && (
        <div className="flex w-full flex-col gap-3">
          <p className="text-center text-sm font-medium text-black">How would you like to pay?</p>

          {/* Recommended: Coinbase hosted — no in-app phone verification */}
          <button
            type="button"
            onClick={() => setPaymentMethod("card")}
            disabled={!isAmountValid}
            className="relative flex w-full items-center gap-3 rounded-xl border-2 border-blue-500 bg-white px-4 py-4 text-left transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="absolute top-2 right-2 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white uppercase">
              Recommended
            </span>
            <span className="text-2xl" aria-hidden="true">
              💳
            </span>
            <div>
              <p className="text-sm font-semibold text-black">All Payment Methods</p>
              <p className="text-xs text-gray-600">
                Card, bank, Apple Pay, or Google Pay via Coinbase — identity verified in their
                secure checkout
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod("digital-wallet")}
            disabled={!isAmountValid}
            className="flex w-full items-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-4 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="text-2xl" aria-hidden="true">
              📱
            </span>
            <div>
              <p className="text-sm font-semibold text-black">Express Checkout</p>
              <p className="text-xs text-gray-600">
                Apple Pay or Google Pay in-app — requires US mobile number verification (SMS)
              </p>
            </div>
          </button>
        </div>
      )}

      {paymentMethod === "digital-wallet" && (
        <div className="flex w-full grow flex-col">
          <HeadlessOnrampFlow
            amount={amount}
            isAmountValid={isAmountValid}
            walletAddress={walletAddress}
            onPaymentCompleted={handlePaymentCompleted}
            receiptEmail={receiptEmail || ""}
            onProcessingPayment={handleProcessingPayment}
            step={step}
            goBack={() => setPaymentMethod(null)}
            MAX_AMOUNT={MAX_AMOUNT}
          />
        </div>
      )}

      {paymentMethod === "card" && (
        <div className="flex w-full grow flex-col">
          <CoinbaseOnrampCheckout
            amount={amount}
            isAmountValid={isAmountValid}
            walletAddress={walletAddress}
            onPaymentCompleted={handlePaymentCompleted}
            receiptEmail={receiptEmail || ""}
            onProcessingPayment={handleProcessingPayment}
            step={step}
            goBack={() => setPaymentMethod(null)}
            MAX_AMOUNT={MAX_AMOUNT}
          />
        </div>
      )}
    </Modal>
  );
}
