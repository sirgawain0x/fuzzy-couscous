import { NextResponse } from "next/server";
import { runMigration } from "@/lib/cockroachdb";

/**
 * POST /api/db/migrate
 * Runs the CockroachDB schema migration. Safe to call multiple times.
 * Protected: only works in development or with a secret header.
 */
export async function POST(request: Request) {
  // Simple protection — only allow in development or with secret
  const isDevEnv = process.env.NODE_ENV !== "production";
  const authHeader = request.headers.get("x-migration-secret");
  const migrationSecret = process.env.MIGRATION_SECRET;

  if (!isDevEnv && authHeader !== migrationSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await runMigration();
    return NextResponse.json({ success: true, message: "Migration complete" });
  } catch (err: any) {
    console.error("[Migration] Failed:", err.message);
    return NextResponse.json({ error: err.message || "Migration failed" }, { status: 500 });
  }
}
