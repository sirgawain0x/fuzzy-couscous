import { NextRequest, NextResponse } from "next/server";
import { generateJWT } from "@/utils/coinbase-sdk";

/**
 * GET /api/onramp/order/[orderId]
 * Polls the status of a Coinbase onramp order.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const keyId = process.env.COINBASE_API_KEY_ID;
    const keySecret = process.env.COINBASE_API_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Coinbase API keys not configured" }, { status: 500 });
    }

    const jwt = await generateJWT(
      keyId,
      keySecret,
      "GET",
      `/platform/v2/onramp/orders/${orderId}`,
      "api.cdp.coinbase.com"
    );

    const response = await fetch(
      `https://api.cdp.coinbase.com/platform/v2/onramp/orders/${orderId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Coinbase order status error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch order status" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Order status error:", err.message);
    return NextResponse.json(
      { error: err.message || "Failed to fetch order status" },
      { status: 500 }
    );
  }
}
