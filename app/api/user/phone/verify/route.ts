import { NextRequest, NextResponse } from "next/server";
import { requireAuthedWallet } from "@/lib/apiAuth";
import { getPool } from "@/lib/cockroachdb";
import { hashOtpCode, isOtpExpired, normalizeE164Phone } from "@/lib/phoneOtp";

/**
 * POST /api/user/phone/verify
 * Verifies an SMS OTP and marks the phone as verified for Coinbase warm-start.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthedWallet(request);
  if (!auth.ok) return auth.response;

  try {
    const { phoneNumber, code } = await request.json();

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
    }
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const normalized = normalizeE164Phone(phoneNumber);
    if (!normalized) {
      return NextResponse.json(
        { error: "Phone number must be in E.164 format (e.g. +12025551234)" },
        { status: 400 }
      );
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT phone_number, code_hash, expires_at
       FROM phone_otp_challenges
       WHERE crossmint_user_id = $1
       LIMIT 1`,
      [auth.session.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "No verification in progress" }, { status: 400 });
    }

    const challenge = rows[0];
    if (challenge.phone_number !== normalized) {
      return NextResponse.json({ error: "Phone number does not match" }, { status: 400 });
    }

    if (isOtpExpired(challenge.expires_at)) {
      return NextResponse.json({ error: "Verification code expired" }, { status: 400 });
    }

    const expectedHash = hashOtpCode(normalized, code.trim());
    if (expectedHash !== challenge.code_hash) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    const verifiedAt = new Date().toISOString();

    await pool.query(
      `INSERT INTO users (crossmint_user_id, wallet_address, phone_number, phone_number_verified_at, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (crossmint_user_id) DO UPDATE SET
         phone_number = EXCLUDED.phone_number,
         phone_number_verified_at = EXCLUDED.phone_number_verified_at,
         updated_at = now()`,
      [auth.session.userId, auth.session.walletAddress, normalized, verifiedAt]
    );

    await pool.query(`DELETE FROM phone_otp_challenges WHERE crossmint_user_id = $1`, [
      auth.session.userId,
    ]);

    return NextResponse.json({
      phoneNumber: normalized,
      phoneNumberVerifiedAt: verifiedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to verify phone number";
    console.error("[user/phone/verify] POST failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
