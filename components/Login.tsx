"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { PrivyLoginModal } from "@/components/auth/PrivyLoginModal";

export function Login() {
  const { login, status } = useAuth();
  // Privy's `login` identity can change while CAPTCHA/OAuth is in-flight.
  // Re-calling it on every change restarts the modal and loops the CAPTCHA success screen.
  const hasRequestedLogin = useRef(false);

  useEffect(() => {
    if (status !== "logged-out") {
      hasRequestedLogin.current = false;
      return;
    }

    if (hasRequestedLogin.current) return;

    hasRequestedLogin.current = true;
    login();
  }, [login, status]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <PrivyLoginModal />
    </div>
  );
}
