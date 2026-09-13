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
import { useCrossmintAuth } from "@crossmint/client-sdk-react-ui";

type AuthStatus = "logged-out" | "logged-in" | "initializing";

interface AuthUser {
  id: string;
  email: string;
  /** Set when the user signed in with Crossmint email OTP (no extra deposit step). */
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

const mapCrossmintStatus = (status: string): AuthStatus => {
  if (status === "logged-in") return "logged-in";
  if (status === "logged-out") return "logged-out";
  return "initializing";
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    status: crossmintStatus,
    user: crossmintUser,
    jwt,
    logout: crossmintLogout,
    getUser,
  } = useCrossmintAuth();

  const [showLogin, setShowLogin] = useState(false);
  const [emailVerifiedAt, setEmailVerifiedAt] = useState<string | undefined>();
  const [phoneNumberVerifiedAt, setPhoneNumberVerifiedAt] = useState<string | undefined>();

  const status = mapCrossmintStatus(crossmintStatus);

  const user: AuthUser | null = useMemo(() => {
    if (!crossmintUser) return null;

    return {
      id: crossmintUser.id,
      email: crossmintUser.email ?? "",
      emailVerifiedAt,
      phoneNumber: crossmintUser.phoneNumber,
      phoneNumberVerifiedAt,
    };
  }, [crossmintUser, emailVerifiedAt, phoneNumberVerifiedAt]);

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
      getUser();
      void refreshUserProfile();
    } else {
      setEmailVerifiedAt(undefined);
      setPhoneNumberVerifiedAt(undefined);
    }
  }, [status, getUser, refreshUserProfile]);

  const login = useCallback(() => {
    setShowLogin(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await crossmintLogout();
    } catch {
      // Session may already be expired
    }
    setEmailVerifiedAt(undefined);
    setPhoneNumberVerifiedAt(undefined);
    // Show login modal immediately — Login only renders CrossmintLoginModal (no page chrome).
    setShowLogin(true);
  }, [crossmintLogout]);

  const value: AuthContextValue = useMemo(
    () => ({
      status,
      user,
      jwt: jwt ?? null,
      sessionToken: jwt ?? null,
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
