import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPostLink } from "@/lib/admin/post-edit";
import { bffAuthRequired, bffError } from "@/lib/admin/bff";

// The Articles list's "View" / "Copy URL" row actions resolve THIS on click —
// the fast list itself never carries a real permalink (see getPostLink's own
// comment). One REST round trip for the one row the user asked about.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return bffAuthRequired();

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  try {
    const link = await getPostLink(postId, session.token);
    return NextResponse.json({ link });
  } catch (e) {
    return bffError(e, "post-link");
  }
}
