import { NextRequest, NextResponse } from "next/server";
import { requireAuthedWallet } from "@/lib/apiAuth";
import { getPool } from "@/lib/cockroachdb";

/**
 * GET /api/user/profile
 * Returns stored profile fields for the authenticated Crossmint user.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthedWallet(request);
  if (!auth.ok) return auth.response;

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT email, email_verified_at, phone_number, phone_number_verified_at
       FROM users WHERE crossmint_user_id = $1 LIMIT 1`,
      [auth.session.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        email: null,
        emailVerifiedAt: null,
        phoneNumber: null,
        phoneNumberVerifiedAt: null,
      });
    }

    const row = rows[0];
    return NextResponse.json({
      email: row.email ?? null,
      emailVerifiedAt: row.email_verified_at
        ? new Date(row.email_verified_at).toISOString()
        : null,
      phoneNumber: row.phone_number ?? null,
      phoneNumberVerifiedAt: row.phone_number_verified_at
        ? new Date(row.phone_number_verified_at).toISOString()
        : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load profile";
    console.error("[profile] GET failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
