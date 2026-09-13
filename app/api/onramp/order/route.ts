import { NextRequest, NextResponse } from "next/server";
import { generateJWT } from "@/utils/coinbase-sdk";
import { requireAuthedWallet } from "@/lib/apiAuth";

/**
 * POST /api/onramp/order
 * Creates a Coinbase Onramp v2 order and returns the paymentLink.
 * Validates Crossmint JWT before accepting the order.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      paymentAmount,
      paymentCurrency = "USD",
      purchaseCurrency = "USDC",
      paymentMethod = "GUEST_CHECKOUT_GOOGLE_PAY",
      destinationAddress,
      destinationNetwork = "base",
      phoneNumber,
      email,
      agreementAcceptedAt,
      phoneNumberVerifiedAt,
      partnerUserRef,
      sessionToken,
      authToken,
      domain,
    } = body;

    // Validate required fields
    if (!paymentAmount || !destinationAddress || !phoneNumber || !email || !agreementAcceptedAt) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: paymentAmount, destinationAddress, phoneNumber, email, agreementAcceptedAt",
        },
        { status: 400 }
      );
    }

    const auth = await requireAuthedWallet(request, authToken ?? sessionToken);
    if (!auth.ok) return auth.response;

    const walletMismatch = destinationAddress.toLowerCase() !== auth.session.walletAddress;
    if (walletMismatch) {
      return NextResponse.json(
        { error: "Destination address does not match authenticated wallet" },
        { status: 403 }
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
    const userRef = isTestnet
      ? `sandbox-${partnerUserRef || destinationAddress}`
      : partnerUserRef || destinationAddress;

    const orderBody: Record<string, any> = {
      paymentAmount: String(paymentAmount),
      paymentCurrency,
      purchaseCurrency,
      paymentMethod,
      destinationAddress,
      destinationNetwork,
      phoneNumber,
      email,
      agreementAcceptedAt,
      phoneNumberVerifiedAt: phoneNumberVerifiedAt || new Date().toISOString(),
      partnerUserRef: userRef,
    };

    // Include domain for Apple Pay iframe verification (production only)
    // localhost is not allow-listed by Coinbase, so skip for local dev
    if (domain && domain !== "localhost" && !domain.startsWith("localhost:")) {
      orderBody.domain = domain;
    }

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
      console.error("Coinbase order API error:", errorText);
      return NextResponse.json({ error: "Failed to create order" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Order creation error:", err.message);
    return NextResponse.json({ error: err.message || "Failed to create order" }, { status: 500 });
  }
}
