/**
 * Fallback JWT generation for Coinbase API without CDP SDK
 * This is a direct implementation that should work in serverless environments
 */
import * as crypto from "crypto";

interface JWTHeader {
  typ: string;
  alg: string;
  kid: string;
  nonce: string;
}

interface JWTPayload {
  iss: string;
  nbf: number;
  exp: number;
  sub: string;
  uri: string;
}

/**
 * Base64 URL encode (without padding)
 */
function base64UrlEncode(data: string | Buffer): string {
  const buffer = typeof data === "string" ? Buffer.from(data) : data;
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Generate JWT using Node.js crypto (fallback method)
 * @param apiKeyId - The CDP API key ID
 * @param apiKeySecret - The CDP API key secret
 * @param requestMethod - HTTP method (GET, POST, etc.)
 * @param requestPath - API endpoint path
 */
export async function generateJWTFallback(
  apiKeyId: string,
  apiKeySecret: string,
  requestMethod: string = "POST",
  requestPath: string = "/onramp/v1/token"
): Promise<string> {
  try {
    console.log("Using fallback JWT generation method...", {
      requestMethod,
      requestPath,
    });

    const requestHost = "api.developer.coinbase.com";
    const uri = `${requestMethod} ${requestHost}${requestPath}`;

    // Create JWT header
    const header: JWTHeader = {
      typ: "JWT",
      alg: "EdDSA",
      kid: apiKeyId,
      nonce: crypto.randomBytes(16).toString("hex"),
    };

    // Create JWT payload
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      iss: "cdp",
      nbf: now,
      exp: now + 120, // 2 minutes
      sub: apiKeyId,
      uri: uri,
    };

    // Encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const message = `${encodedHeader}.${encodedPayload}`;

    console.log("JWT components created, signing...");

    // Decode the base64 private key
    const privateKeyBuffer = Buffer.from(apiKeySecret, "base64");

    // Create Ed25519 private key object
    const privateKey = crypto.createPrivateKey({
      key: privateKeyBuffer,
      format: "der",
      type: "pkcs8",
    });

    // Sign the message using Ed25519
    const signature = crypto.sign(null, Buffer.from(message), privateKey);

    // Encode signature
    const encodedSignature = base64UrlEncode(signature);

    const jwt = `${message}.${encodedSignature}`;

    console.log("Fallback JWT generated successfully");
    return jwt;
  } catch (error) {
    console.error("Fallback JWT generation failed:", error);
    throw new Error(
      `Fallback JWT generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
