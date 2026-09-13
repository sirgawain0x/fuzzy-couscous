"use server";

import { generateJWT } from "@/utils/coinbase-sdk";

export default async function createCoinbaseSessionToken({
  address,
  blockchains,
  assets,
}: {
  address: string;
  blockchains: string[];
  assets: string[];
}) {
  try {
    console.log("=== createCoinbaseSessionToken called ===", {
      address,
      blockchains,
      assets,
      nodeEnv: process.env.NODE_ENV,
      hasKeyId: !!process.env.COINBASE_API_KEY_ID,
      hasKeySecret: !!process.env.COINBASE_API_KEY_SECRET,
    });

    // Validate environment variables
    if (!process.env.COINBASE_API_KEY_ID || !process.env.COINBASE_API_KEY_SECRET) {
      console.error("Missing Coinbase API keys:", {
        hasKeyId: !!process.env.COINBASE_API_KEY_ID,
        hasKeySecret: !!process.env.COINBASE_API_KEY_SECRET,
        nodeEnv: process.env.NODE_ENV,
      });
      throw new Error(
        "Coinbase API keys are not configured. Please check your environment variables."
      );
    }

    // Validate input parameters
    if (!address || !blockchains.length || !assets.length) {
      console.error("Invalid input parameters:", { address, blockchains, assets });
      throw new Error("Missing required parameters: address, blockchains, or assets");
    }

    // Validate blockchain format for Coinbase compatibility
    const validBlockchains = ["base"];
    const invalidBlockchains = blockchains.filter(
      (chain) => !validBlockchains.includes(chain.toLowerCase())
    );

    if (invalidBlockchains.length > 0) {
      console.error("Invalid blockchain names:", {
        provided: blockchains,
        invalid: invalidBlockchains,
        valid: validBlockchains,
      });
      throw new Error(
        `Invalid blockchain names: ${invalidBlockchains.join(", ")}. Valid options: ${validBlockchains.join(", ")}`
      );
    }

    // Allow session token creation in any environment if API keys are configured
    // This enables testing withdrawals in development/staging environments
    console.log("Environment checks passed, generating JWT...");

    const url = "https://api.developer.coinbase.com";
    const method = "POST";
    const request_path = "/onramp/v1/token";

    try {
      // Use the new CDP SDK to generate JWT with correct request parameters
      console.log("Attempting to generate JWT...");
      const jwt = await generateJWT(
        process.env.COINBASE_API_KEY_ID!,
        process.env.COINBASE_API_KEY_SECRET!,
        method,
        request_path
      );

      console.log("JWT generated successfully, making API request...");

      const requestBody = {
        addresses: [
          {
            address,
            blockchains,
          },
        ],
        assets,
      };

      console.log("Creating session token with:", {
        address,
        blockchains,
        assets,
        hasJWT: !!jwt,
      });

      const response = await fetch(`${url}${request_path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Coinbase session token creation failed:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        // Provide more specific error messages based on status codes
        if (response.status === 401) {
          throw new Error("Invalid Coinbase API credentials. Please check your API keys.");
        } else if (response.status === 403) {
          throw new Error("Insufficient permissions. Please check your API key permissions.");
        } else if (response.status === 429) {
          throw new Error("Too many requests. Please try again later.");
        } else if (response.status >= 500) {
          throw new Error("Coinbase service is temporarily unavailable. Please try again later.");
        } else {
          throw new Error(`Coinbase API error (${response.status}): ${errorText}`);
        }
      }

      const data = await response.json();
      // Handle both response structures: { data: { token } } and { token }
      const token = data.data?.token || data.token;

      if (!token) {
        console.error("No token in response:", data);
        throw new Error("No session token received from Coinbase API");
      }

      console.log("Session token created successfully");
      return token;
    } catch (error) {
      console.error("Session token creation error:", error);

      // Re-throw with a more user-friendly message if it's a network error
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          "Network error: Unable to connect to Coinbase API. Please check your connection."
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("=== createCoinbaseSessionToken ERROR ===", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      nodeEnv: process.env.NODE_ENV,
      hasKeyId: !!process.env.COINBASE_API_KEY_ID,
      hasKeySecret: !!process.env.COINBASE_API_KEY_SECRET,
    });

    // Return null instead of throwing to prevent 500 errors
    return null;
  }
}
