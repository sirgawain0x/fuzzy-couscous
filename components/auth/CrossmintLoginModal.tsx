"use client";

import { useEffect } from "react";
import { EmbeddedAuthForm } from "@crossmint/client-sdk-react-ui";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/context/AuthContext";
import styles from "./CrossmintLoginModal.module.css";

const loginModalTitle = (
  <>
    Welcome to <span style={{ fontFamily: "var(--font-conthrax), sans-serif" }}>CREATIVE</span>{" "}
    Finance
  </>
);

export function CrossmintLoginModal() {
  const { showLogin, setShowLogin, status } = useAuth();
  const isLoggedOut = status === "logged-out";
  const modalOpen = isLoggedOut || showLogin;

  useEffect(() => {
    if (status === "logged-in" && showLogin) {
      setShowLogin(false);
    }
  }, [status, showLogin, setShowLogin]);

  const handleClose = () => {
    if (isLoggedOut) return;
    setShowLogin(false);
  };

  return (
    <Modal open={modalOpen} onClose={handleClose} title={loginModalTitle}>
      <div className="flex flex-col items-center gap-4 py-2">
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">Google or Email</p>
        <div className={`${styles.crossmintFormWrap} w-full`}>
          <EmbeddedAuthForm />
        </div>
        <p className="text-center text-xs text-gray-500">
          By continuing, you accept the{" "}
          <a
            href="https://www.crossmint.com/legal/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Wallet&apos;s Terms of Service
          </a>
          , and to receive marketing communications from Creative Org DAO.
        </p>
      </div>
    </Modal>
  );
}
