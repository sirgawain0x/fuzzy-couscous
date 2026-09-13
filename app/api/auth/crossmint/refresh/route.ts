import { NextRequest } from "next/server";
import { getCrossmintAuth } from "@/lib/crossmint-server";

/**
 * POST /api/auth/crossmint/refresh
 * Refreshes Crossmint Auth session cookies (used by CrossmintAuthProvider).
 */
export async function POST(request: NextRequest) {
  try {
    const crossmintAuth = getCrossmintAuth();
    return (await crossmintAuth.handleCustomRefresh(request)) as Response;
  } catch (error) {
    console.error("[Crossmint Auth] Refresh failed:", error);
    return Response.json({ error: "Failed to refresh session" }, { status: 401 });
  }
}
