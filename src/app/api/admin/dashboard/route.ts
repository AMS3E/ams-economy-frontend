import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readDashboard } from "@/lib/admin/dashboard";
import { clampRange } from "@/lib/admin/constants";
import { bffAuthRequired, bffError } from "@/lib/admin/bff";

// BFF read for the Dashboard, fresh on every request (A6): what used to be
// six ~4s WP round trips behind a per-user 30min cache is one ~300ms fast
// call, so the cache tier is gone.
//
// `range` is the chart's window (7/30/90, clamped server-side — a 365-day
// aggregate over WPP's summary table measured 57 seconds live). The user's
// capabilities go down to the FALLBACK only: the fast path reads the real ones
// out of the verified token, and never trusts what this route thinks.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return bffAuthRequired();
  const { token, user } = session;

  const range = clampRange(new URL(req.url).searchParams.get("range"));

  try {
    return NextResponse.json({
      ...(await readDashboard(range, user.id, user.capabilities, token)),
      fetchedAt: Date.now(),
    });
  } catch (e) {
    return bffError(e, "dashboard");
  }
}
