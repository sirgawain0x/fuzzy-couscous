import { createCrossmint, CrossmintAuth } from "@crossmint/server-sdk";

let crossmintAuth: CrossmintAuth | null = null;

/**
 * Server-side Crossmint Auth (session refresh, logout, JWT verification).
 * Requires CROSSMINT_SERVER_API_KEY (server API key from Crossmint Console).
 */
export function getCrossmintAuth(): CrossmintAuth {
  if (crossmintAuth) return crossmintAuth;

  // Primary name matches .env.template and lib/crossmintAuth.ts
  // (CROSSMINT_SERVER_SIDE_API_KEY). The remaining names are accepted as
  // fallbacks so a differently-named secret still works.
  const apiKey =
    process.env.CROSSMINT_SERVER_SIDE_API_KEY ||
    process.env.CROSSMINT_SERVER_API_KEY ||
    process.env.SERVER_CROSSMINT_API_KEY ||
    process.env.CROSSMINT_API_KEY;

  if (!apiKey) {
    throw new Error(
      "CROSSMINT_SERVER_SIDE_API_KEY is required for Crossmint Auth API routes and session validation."
    );
  }

  const crossmint = createCrossmint({ apiKey });
  crossmintAuth = CrossmintAuth.from(crossmint);
  return crossmintAuth;
}
