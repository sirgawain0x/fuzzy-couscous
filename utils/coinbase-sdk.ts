/**
 * Session Token API utilities for secure initialization
 */
import { generateJwt } from "@coinbase/cdp-sdk/auth";
import { generateJWTFallback } from "./coinbase-fallback";

interface SessionTokenRequest {
  addresses: Array<{
    address: string;
    blockchains: string[];
  }>;
  assets?: string[];
}

interface SessionTokenResponse {
  token: string;
  channel_id?: string;
}

/**
 * Generates a JWT token for CDP API authentication using the CDP SDK
 * @param keyName - The CDP API key name
 * @param keySecret - The CDP API private key
 * @param requestMethod - HTTP method (GET, POST, etc.)
 * @param requestPath - API endpoint path
 * @returns Promise of signed JWT token
 */
export async function generateJWT(
  keyName: string,
  keySecret: string,
  requestMethod: string = "POST",
  requestPath: string = "/onramp/v1/token",
  requestHost: string = "api.developer.coinbase.com"
): Promise<string> {
  try {
    console.log("Generating JWT with CDP SDK...", {
      hasKeyName: !!keyName,
      hasKeySecret: !!keySecret,
      keyNameLength: keyName?.length,
      requestMethod,
      requestHost,
      requestPath,
    });

    // Use the CDP SDK to generate the JWT
    const token = await generateJwt({
      apiKeyId: keyName,
      apiKeySecret: keySecret,
      requestMethod: requestMethod,
      requestHost: requestHost,
      requestPath: requestPath,
      expiresIn: 120, // optional (defaults to 120 seconds)
    });

    console.log("JWT generated successfully with CDP SDK");
    return token;
  } catch (error) {
    console.error("CDP SDK JWT generation failed, trying fallback method:", error);

    try {
      // Try the fallback method with the same request parameters
      const token = await generateJWTFallback(keyName, keySecret, requestMethod, requestPath);
      console.log("JWT generated successfully with fallback method");
      return token;
    } catch (fallbackError) {
      console.error("Both CDP SDK and fallback JWT generation failed:", {
        cdpError: error instanceof Error ? error.message : "Unknown CDP error",
        fallbackError:
          fallbackError instanceof Error ? fallbackError.message : "Unknown fallback error",
      });

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes("key") || error.message.includes("API")) {
          throw new Error("Invalid Coinbase API key format or credentials");
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
          throw new Error("Network error while generating authentication token");
        } else {
          throw new Error(`JWT generation failed: ${error.message}`);
        }
      }

      throw new Error("Failed to generate authentication token");
    }
  }
}

/**
 * Generates a session token for secure onramp/offramp initialization
 * @param params - The parameters for session token generation
 * @returns The session token or null if generation fails
 */
export async function generateSessionToken(params: SessionTokenRequest): Promise<string | null> {
  try {
    const response = await fetch("/api/onramp/session-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Session token generation failed:", error);
      throw new Error(error.error || "Failed to generate session token");
    }

    const data: SessionTokenResponse = await response.json();
    return data.token;
  } catch (error) {
    console.error("Error generating session token:", error);
    return null;
  }
}

/**
 * Helper function to format addresses for session token request
 * @param address - The wallet address
 * @param networks - Array of blockchain networks
 * @returns Formatted addresses array
 */
export function formatAddressesForToken(
  address: string,
  networks: string[]
): Array<{ address: string; blockchains: string[] }> {
  return [
    {
      address,
      blockchains: networks,
    },
  ];
}

/**
 * Example usage for developers
 *
 * ```typescript
 * // Generate a session token for onramp
 * const token = await generateSessionToken({
 *   addresses: [{
 *     address: "0x1234567890123456789012345678901234567890",
 *     blockchains: ["ethereum", "base"]
 *   }],
 *   assets: ["ETH", "USDC"]
 * });
 *
 * // Use the token in onramp URL
 * const onrampUrl = generateOnrampURL({
 *   sessionToken: token,
 *   // ... other params
 * });
 * ```
 */
