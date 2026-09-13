import { getCrossmintAuth } from "@/lib/crossmint-server";

/**
 * Validates a Crossmint Auth JWT from Authorization headers and returns the user id.
 */
export async function getUserIdFromCrossmintJwt(jwt: string): Promise<string> {
  const crossmintAuth = getCrossmintAuth();
  const payload = await crossmintAuth.verifyCrossmintJwt(jwt);
  const userId = (payload.sub ?? payload.userId) as string | undefined;
  if (!userId) {
    throw new Error("JWT missing user identifier");
  }
  return userId;
}
