import { createCrossmint } from "@crossmint/common-sdk-base";
import { CrossmintAuth } from "@crossmint/common-sdk-auth";
import { createRemoteJWKSet, jwtVerify } from "jose";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const getJwks = () => {
  if (jwks) return jwks;

  const apiKey =
    process.env.CROSSMINT_SERVER_SIDE_API_KEY ?? process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY;

  if (!apiKey) {
    throw new Error(
      "CROSSMINT_SERVER_SIDE_API_KEY or NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY must be set"
    );
  }

  const crossmint = createCrossmint({ apiKey });
  const auth = CrossmintAuth.from(crossmint);
  jwks = createRemoteJWKSet(new URL(auth.getJwksUri()));
  return jwks;
};

export type VerifiedCrossmintSession = {
  userId: string;
};

/**
 * Validates a Crossmint auth JWT (Bearer token) and returns the Crossmint user id.
 */
export const verifyCrossmintJwt = async (token: string): Promise<VerifiedCrossmintSession> => {
  const { payload } = await jwtVerify(token, getJwks());

  const userId =
    (typeof payload.sub === "string" && payload.sub) ||
    (typeof payload.userId === "string" && payload.userId) ||
    (typeof payload.user_id === "string" && payload.user_id);

  if (!userId) {
    throw new Error("JWT missing user identifier");
  }

  return { userId };
};
