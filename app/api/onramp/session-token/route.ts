import { NextRequest, NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { generateJWT } from "@/utils/coinbase-sdk";

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    // Validate environment variables
    if (!process.env.COINBASE_API_KEY_ID || !process.env.COINBASE_API_KEY_SECRET) {
      return NextResponse.json({ error: "Coinbase API keys are not configured" }, { status: 500 });
    }

    // Validate production environment - allow if API keys are configured
    if (
      process.env.NODE_ENV !== "production" &&
      (!process.env.COINBASE_API_KEY_ID || !process.env.COINBASE_API_KEY_SECRET)
    ) {
      return NextResponse.json(
        { error: "Session tokens require Coinbase API keys to be configured" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { addresses, assets } = body;

    // Validate input
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ error: "Invalid addresses parameter" }, { status: 400 });
    }

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return NextResponse.json({ error: "Invalid assets parameter" }, { status: 400 });
    }

    const url = "https://api.developer.coinbase.com";
    const method = "POST";
    const request_path = "/onramp/v1/token";

    try {
      // Generate JWT using CDP SDK with correct request parameters
      const jwt = await generateJWT(
        process.env.COINBASE_API_KEY_ID!,
        process.env.COINBASE_API_KEY_SECRET!,
        method,
        request_path
      );

      const requestBody = {
        addresses,
        assets,
      };

      console.log("Creating session token via API route:", {
        addresses,
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

        return NextResponse.json(
          { error: `Coinbase API error (${response.status}): ${errorText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      // Handle both response structures: { data: { token } } and { token }
      const token = data.data?.token || data.token;

      if (!token) {
        console.error("No token in response:", data);
        return NextResponse.json(
          { error: "No session token received from Coinbase API" },
          { status: 500 }
        );
      }

      console.log("Session token created successfully via API route");
      return NextResponse.json({ token });
    } catch (error) {
      console.error("Session token creation error:", error);
      return NextResponse.json({ error: "Failed to create session token" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error in session token API route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
