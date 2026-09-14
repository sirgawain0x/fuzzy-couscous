import { PrivyClient } from "@privy-io/server-auth";

let privyClient: PrivyClient | null = null;

/** Primary env names from .env.template, plus legacy aliases used in some local setups. */
const resolvePrivyAppCredentials = (): { appId: string; appSecret: string } => {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET || process.env.PRIVY_SECRET;

  if (!appId || !appSecret) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
  }

  return { appId, appSecret };
};

const getPrivyClient = (): PrivyClient => {
  if (privyClient) return privyClient;

  const { appId, appSecret } = resolvePrivyAppCredentials();
  privyClient = new PrivyClient(appId, appSecret);
  return privyClient;
};

export type VerifiedPrivySession = {
  userId: string;
};

/**
 * Validates a Privy access token (Bearer) and returns the Privy user id (DID).
 */
export const verifyPrivyAccessToken = async (token: string): Promise<VerifiedPrivySession> => {
  const client = getPrivyClient();
  const claims = await client.verifyAuthToken(token);

  if (!claims.userId) {
    throw new Error("Token missing user identifier");
  }

  return { userId: claims.userId };
};
