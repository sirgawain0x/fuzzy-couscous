import { NextRequest, NextResponse } from "next/server";
import { generateJWT } from "@/utils/coinbase-sdk";

/**
 * POST /api/onramp/quote
 * Fetches a quote from the Coinbase Onramp v2 API.
 * Uses the order endpoint with isQuote=true — requires all order fields.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      paymentAmount,
      paymentCurrency = "USD",
      purchaseCurrency = "USDC",
      destinationNetwork = "base",
      destinationAddress,
      paymentMethod = "GUEST_CHECKOUT_GOOGLE_PAY",
      phoneNumber,
      email,
      agreementAcceptedAt,
      phoneNumberVerifiedAt,
    } = body;

    if (!paymentAmount || !destinationAddress || !email || !phoneNumber || !agreementAcceptedAt) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: paymentAmount, destinationAddress, email, phoneNumber, agreementAcceptedAt",
        },
        { status: 400 }
      );
    }

    const keyId = process.env.COINBASE_API_KEY_ID;
    const keySecret = process.env.COINBASE_API_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Coinbase API keys not configured" }, { status: 500 });
    }

    const jwt = await generateJWT(
      keyId,
      keySecret,
      "POST",
      "/platform/v2/onramp/orders",
      "api.cdp.coinbase.com"
    );

    // Determine partnerUserRef — use sandbox- prefix for testing
    const isTestnet = process.env.NEXT_PUBLIC_CHAIN_ID === "base-sepolia";
    const userRef = isTestnet ? `sandbox-${destinationAddress}` : destinationAddress;

    const orderBody: Record<string, any> = {
      paymentAmount: String(paymentAmount),
      paymentCurrency,
      purchaseCurrency,
      destinationNetwork,
      destinationAddress,
      paymentMethod,
      phoneNumber,
      email,
      agreementAcceptedAt,
      phoneNumberVerifiedAt: phoneNumberVerifiedAt || new Date().toISOString(),
      partnerUserRef: userRef,
      isQuote: true,
    };

    console.log("Coinbase quote request:", JSON.stringify(orderBody, null, 2));

    const response = await fetch("https://api.cdp.coinbase.com/platform/v2/onramp/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Coinbase quote API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch quote", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Quote API error:", err.message);
    return NextResponse.json({ error: err.message || "Failed to fetch quote" }, { status: 500 });
  }
}
