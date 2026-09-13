/**
 * Detection helpers for WebAuthn / passkey availability.
 *
 * Many "in-app browsers" (Gmail, Facebook, Instagram, Twitter, TikTok, LINE,
 * WeChat, etc.) embed a stripped-down WebView that can complete OAuth but
 * cannot create or use WebAuthn credentials. Trying to provision a Crossmint
 * wallet with a passkey signer in those environments fails with no user-
 * actionable feedback. We use these helpers to:
 *
 *   1. Detect those environments up-front so we can show a helpful warning.
 *   2. Fall back to a non-passkey signer (email OTP) when WebAuthn is missing.
 */

const IN_APP_BROWSER_UA_PATTERNS: RegExp[] = [
  /\bFB[A-Z]V?\//i, // Facebook
  /\bFBAN\//i, // Facebook iOS
  /\bFBIOS\//i,
  /Instagram/i,
  /TikTok/i,
  /Twitter/i,
  /LinkedIn/i,
  /Line\//i,
  /MicroMessenger/i, // WeChat
  /KAKAOTALK/i,
  /Snapchat/i,
  /Pinterest/i,
  /; wv\)/i, // Generic Android WebView marker
  /GSA\//i, // Google Search App (a common host of Gmail in-app browsing)
];

export const isInAppBrowser = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return IN_APP_BROWSER_UA_PATTERNS.some((re) => re.test(ua));
};

/**
 * Returns true when the current environment exposes the WebAuthn primitives
 * Crossmint needs to create a passkey. Returns false in SSR and in WebViews
 * that omit the API (or have it but with no platform authenticator).
 *
 * This is intentionally conservative: a `false` result means "definitely no",
 * a `true` result means "probably yes — try it". The caller should still
 * handle creation failures.
 */
export const isPasskeyLikelyAvailable = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  if (typeof window.PublicKeyCredential === "undefined") return false;
  if (!window.isSecureContext) return false;

  try {
    if (
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
    ) {
      const available =
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return Boolean(available);
    }
  } catch {
    return false;
  }
  // The browser exposes `PublicKeyCredential` but not the availability check —
  // attempt the flow rather than block it.
  return true;
};

/**
 * True when we should avoid even trying to create a passkey — the environment
 * is known to be hostile (in-app browser) OR the WebAuthn API is missing.
 */
export const shouldSkipPasskey = async (): Promise<boolean> => {
  if (isInAppBrowser()) return true;
  const available = await isPasskeyLikelyAvailable();
  return !available;
};

/**
 * True when an error thrown during `createWallet({ signers: [{ type: 'passkey' }] })`
 * looks like a WebAuthn failure (user cancelled, OS doesn't support, page is
 * not a secure context, etc.) — meaning we should retry with a non-passkey
 * signer rather than surface the raw error.
 */
export const isPasskeyCreationFailure = (err: unknown): boolean => {
  if (!err) return false;
  const e = err as { name?: string; code?: string | number; message?: string };
  if (e.name === "NotAllowedError") return true; // user dismissed / OS blocked
  if (e.name === "NotSupportedError") return true;
  if (e.name === "SecurityError") return true;
  if (e.name === "AbortError") return true;
  if (e.name === "InvalidStateError") return true;
  const msg = (e.message || "").toLowerCase();
  if (msg.includes("passkey")) return true;
  if (msg.includes("webauthn")) return true;
  if (msg.includes("publickeycredential")) return true;
  if (msg.includes("platform authenticator")) return true;
  return false;
};
