import { NextRequest, NextResponse } from "next/server";
import { requireAuthedWallet } from "@/lib/apiAuth";
import { getPool } from "@/lib/cockroachdb";
import {
  generateOtpCode,
  getOtpExpiry,
  getTwilioConfig,
  hashOtpCode,
  normalizeE164Phone,
  sendSmsOtp,
} from "@/lib/phoneOtp";

/**
 * POST /api/user/phone/send
 * Sends an SMS OTP to verify phone ownership for Coinbase onramp warm-start.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthedWallet(request);
  if (!auth.ok) return auth.response;

  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
    }

    const normalized = normalizeE164Phone(phoneNumber);
    if (!normalized) {
      return NextResponse.json(
        { error: "Phone number must be in E.164 format (e.g. +12025551234)" },
        { status: 400 }
      );
    }

    const twilio = getTwilioConfig();
    const isDev = process.env.NODE_ENV !== "production";

    if (!twilio && !isDev) {
      return NextResponse.json(
        { error: "SMS verification is not configured. Contact support." },
        { status: 503 }
      );
    }

    const code = generateOtpCode();
    const codeHash = hashOtpCode(normalized, code);
    const expiresAt = getOtpExpiry();
    const pool = getPool();

    await pool.query(
      `INSERT INTO phone_otp_challenges (crossmint_user_id, phone_number, code_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (crossmint_user_id) DO UPDATE SET
         phone_number = EXCLUDED.phone_number,
         code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at,
         created_at = now()`,
      [auth.session.userId, normalized, codeHash, expiresAt]
    );

    if (twilio) {
      await sendSmsOtp(normalized, code);
    } else if (isDev) {
      console.warn(`[dev] Phone OTP for ${normalized}: ${code}`);
    }

    return NextResponse.json({
      methodId: auth.session.userId,
      ...(isDev && !twilio ? { devCode: code } : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send verification code";
    console.error("[user/phone/send] POST failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
