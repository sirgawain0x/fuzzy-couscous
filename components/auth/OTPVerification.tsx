"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { PrimaryButton } from "@/components/common/PrimaryButton";

interface OTPVerificationProps {
  /** "email" or "phone" */
  type: "email" | "phone";
  /** The email address or phone number being verified */
  destination: string;
  /** Called when user submits the OTP code */
  onVerify: (code: string) => Promise<void>;
  /** Called to resend the OTP */
  onResend: () => Promise<void>;
  /** Optional error message */
  error?: string | null;
  /** Whether verification is in progress */
  isVerifying?: boolean;
}

const CODE_LENGTH = 6;

export function OTPVerification({
  type,
  destination,
  onVerify,
  onResend,
  error,
  isVerifying = false,
}: OTPVerificationProps) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const submit = async (fullCode: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onVerify(fullCode);
    } catch {
      // Error surfaced via parent `error` prop
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    // Only accept digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    // Auto-advance to next input
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (digit && index === CODE_LENGTH - 1 && next.every((d) => d)) {
      submit(next.join(""));
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);

    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();

    if (next.every((d) => d)) {
      submit(next.join(""));
    }
  };

  const handleResend = async () => {
    await onResend();
    setResendCooldown(30);
    setDigits(Array(CODE_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
  };

  const code = digits.join("");
  const isComplete = code.length === CODE_LENGTH;
  const label = type === "email" ? "email" : "phone number";

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-gray-900">
        Enter the {CODE_LENGTH}-digit code sent to your {label}
      </p>
      <p className="text-center text-xs font-medium text-black">{destination}</p>

      <div className="flex gap-2" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={isVerifying}
            className="h-12 w-10 rounded-md border border-gray-600 bg-gray-300 text-center text-lg font-semibold text-black focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
          />
        ))}
      </div>

      {error && <p className="text-center text-sm text-red-700">{error}</p>}

      <PrimaryButton
        onClick={() => submit(code)}
        disabled={!isComplete || isVerifying || isSubmitting}
      >
        {isVerifying || isSubmitting ? "Verifying..." : "Verify"}
      </PrimaryButton>

      <button
        onClick={handleResend}
        disabled={resendCooldown > 0 || isVerifying || isSubmitting}
        className="text-sm text-blue-700 hover:underline disabled:text-gray-900 disabled:no-underline"
      >
        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
      </button>
    </div>
  );
}
