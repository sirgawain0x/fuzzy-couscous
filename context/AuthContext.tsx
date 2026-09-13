"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePrivy } from "@privy-io/react-auth";

type AuthStatus = "logged-out" | "logged-in" | "initializing";

interface AuthUser {
  id: string;
  email: string;
  emailVerifiedAt?: string;
  phoneNumber?: string;
  phoneNumberVerifiedAt?: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  jwt: string | null;
  /** @deprecated Use `jwt` — kept for API routes that still accept sessionToken in bodies */
  sessionToken: string | null;
  login: () => void;
  logout: () => Promise<void>;
  showLogin: boolean;
  setShowLogin: (show: boolean) => void;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const mapPrivyStatus = (ready: boolean, authenticated: boolean): AuthStatus => {
  if (!ready) return "initializing";
  if (authenticated) return "logged-in";
  return "logged-out";
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user: privyUser, logout: privyLogout, getAccessToken, login: privyLogin } =
    usePrivy();

  const [showLogin, setShowLogin] = useState(false);
  const [jwt, setJwt] = useState<string | null>(null);
  const [emailVerifiedAt, setEmailVerifiedAt] = useState<string | undefined>();
  const [phoneNumberVerifiedAt, setPhoneNumberVerifiedAt] = useState<string | undefined>();

  const status = mapPrivyStatus(ready, authenticated);

  const user: AuthUser | null = useMemo(() => {
    if (!privyUser) return null;

    const emailAccount = privyUser.email?.address ?? privyUser.google?.email ?? "";
    const phoneAccount = privyUser.phone?.number;

    return {
      id: privyUser.id,
      email: emailAccount,
      emailVerifiedAt,
      phoneNumber: phoneAccount,
      phoneNumberVerifiedAt,
    };
  }, [privyUser, emailVerifiedAt, phoneNumberVerifiedAt]);

  useEffect(() => {
    if (!authenticated) {
      setJwt(null);
      return;
    }

    void getAccessToken().then((token) => setJwt(token));
  }, [authenticated, getAccessToken, privyUser?.id]);

  const refreshUserProfile = useCallback(async () => {
    if (!jwt) {
      setEmailVerifiedAt(undefined);
      setPhoneNumberVerifiedAt(undefined);
      return;
    }

    try {
      const response = await fetch("/api/user/profile", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!response.ok) return;

      const data = await response.json();
      if (data.emailVerifiedAt) {
        setEmailVerifiedAt(data.emailVerifiedAt);
      }
      if (data.phoneNumberVerifiedAt) {
        setPhoneNumberVerifiedAt(data.phoneNumberVerifiedAt);
      }
    } catch {
      // Profile fetch is best-effort (warm start for Coinbase onramp)
    }
  }, [jwt]);

  useEffect(() => {
    if (status === "logged-in") {
      void refreshUserProfile();
    } else {
      setEmailVerifiedAt(undefined);
      setPhoneNumberVerifiedAt(undefined);
    }
  }, [status, refreshUserProfile]);

  const login = useCallback(() => {
    setShowLogin(true);
    privyLogin();
  }, [privyLogin]);

  const logout = useCallback(async () => {
    try {
      await privyLogout();
    } catch {
      // Session may already be expired
    }
    setJwt(null);
    setEmailVerifiedAt(undefined);
    setPhoneNumberVerifiedAt(undefined);
    setShowLogin(true);
  }, [privyLogout]);

  const value: AuthContextValue = useMemo(
    () => ({
      status,
      user,
      jwt,
      sessionToken: jwt,
      login,
      logout,
      showLogin,
      setShowLogin,
      refreshUserProfile,
    }),
    [status, user, jwt, login, logout, showLogin, refreshUserProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
