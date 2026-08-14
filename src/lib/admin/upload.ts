// Media upload core — shared by the /api/admin/upload Route Handler.
//
// Uploads deliberately do NOT travel through a Server Action: the action
// layer's FormData/File encoding 500'd even on small files (observed in dev,
// opaque RSC digest errors), and a Route Handler receiving the raw multipart
// body is the standard Next pattern for binary payloads anyway. This module
// is plain server code (reads next/headers) — import it from Route Handlers
// or other server code, never a Client Component.

import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const BASE = process.env.API_BASE_URL ?? "https://economy.ams.com.kh/wp-json";

export interface UploadResult {
  ok: boolean;
  error?: string;
  /** 401 marker so the client can route to /login instead of showing an error. */
  authExpired?: boolean;
  /** Present on success. */
  id?: number;
  thumb?: string;
  /** Full-size source URL (body-editor embeds want this, not the thumb). */
  url?: string;
}

/** Keep a recognizable ASCII filename for the Content-Disposition header;
 *  WordPress derives the attachment slug from it. Khmer/emoji filenames become
 *  "upload-<ts>.<ext>" rather than a header WP might reject. */
function asciiFilename(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  if (/^[\w-]+\.[A-Za-z0-9]+$/.test(cleaned)) return cleaned;
  const ext = /\.([A-Za-z0-9]+)$/.exec(name)?.[1] ?? "bin";
  return `upload-${Date.now()}.${ext}`;
}

/**
 * Upload one image to the WordPress media library as the logged-in user
 * (raw-body POST wp/v2/media — the standard core contract).
 *
 * ⚠ s3.ams.com.kh offload plugin behavior over REST is still being verified —
 * first live test tells us whether the offload layer honors this contract.
 */
export async function uploadImage(file: unknown): Promise<UploadResult> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Pick a file first." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "Only images for now." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Keep uploads under 10 MB." };

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { ok: false, authExpired: true, error: "Session expired — log in again." };

  const res = await fetch(`${BASE}/wp/v2/media`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "X-AMS-Token": token,
      "content-type": file.type,
      "content-disposition": `attachment; filename="${asciiFilename(file.name)}"`,
    },
    body: Buffer.from(await file.arrayBuffer()),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000), // uploads are big; still bounded
  }).catch(() => null);

  if (!res) return { ok: false, error: "Couldn't reach WordPress." };
  if (res.status === 401) return { ok: false, authExpired: true, error: "Session expired — log in again." };
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.warn(`[uploadImage] WP ${res.status}: ${detail.slice(0, 200)}`);
    return { ok: false, error: `WordPress rejected the upload (${res.status}).` };
  }

  const created = (await res.json().catch(() => null)) as
    | { id?: number; source_url?: string; media_details?: { sizes?: Record<string, { source_url?: string }> } }
    | null;
  if (!created?.id) return { ok: false, error: "Upload succeeded but the response was unreadable." };
  return {
    ok: true,
    id: created.id,
    thumb:
      created.media_details?.sizes?.thumbnail?.source_url ??
      created.media_details?.sizes?.medium?.source_url ??
      created.source_url ??
      "",
    url: created.source_url ?? "",
  };
}
