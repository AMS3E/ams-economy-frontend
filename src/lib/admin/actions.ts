"use server";

// Server Actions for the article editor. The editor (a Client Component) calls
// these with a structured payload; they write through core wp/v2/posts as the
// logged-in user and report a typed result the editor can render.

import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { updatePost, createPost, type PostWrite } from "./post-edit";
import { AdminAuthError, AdminApiError } from "./client";
import { safeTag } from "@/lib/api/client";

/** The editable field set. Sent whole; the layer forwards it to WordPress. */
export interface EditorPayload {
  title: string;
  /** Body HTML from the TipTap editor. ABSENT (undefined) when the user never
   *  touched the body — the write then omits `content` entirely so an existing
   *  Gutenberg body is not flattened by a metadata-only save. */
  content?: string;
  excerpt: string;
  status: string; // "draft" | "pending" | "publish"
  categories: number[];
  /** Slugs of the checked categories — used only to scope cache revalidation
   *  to the affected category pages (the editor has them at hand). */
  categorySlugs: string[];
  /** Tag term ids (the typeahead resolves names → ids, creating as needed). */
  tags: number[];
  /** Featured-image attachment id; 0 = leave unset/clear. */
  featuredMedia: number;
  /** Visibility, mirroring WordPress's own model: a post is public, private
   *  (status), or password-protected. "" clears an existing password. */
  password: string;
  /** "Stick this post to the front page." Ours is a curated homepage, so it
   *  affects WordPress's own archives rather than our landing pages. */
  sticky: boolean;
  seo: { title: string; description: string; focus: string };
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  /** Present on success — the saved status/slug echoed back from WordPress. */
  status?: string;
  slug?: string;
  /** New post id, on a successful create. */
  id?: number;
}

function toWrite(p: EditorPayload): PostWrite {
  return {
    title: p.title,
    ...(p.content !== undefined ? { content: p.content } : {}),
    excerpt: p.excerpt,
    status: p.status,
    categories: p.categories,
    tags: p.tags,
    featured_media: p.featuredMedia,
    password: p.password,
    sticky: p.sticky,
    meta: {
      _yoast_wpseo_title: p.seo.title,
      _yoast_wpseo_metadesc: p.seo.description,
      _yoast_wpseo_focuskw: p.seo.focus,
    },
  };
}

/** Refresh the complete public article surface. A save is allowed to unpublish
 *  or rename an existing live post, but the response only carries the NEW
 *  status/slug. Blanket list/detail tags therefore provide the correctness
 *  boundary; scoped tags keep the mapping explicit and useful for diagnostics. */
function refreshPublic(slug: string | undefined, categorySlugs: string[]) {
  for (const tag of ["articles", "article", "categories", "authors"]) {
    revalidateTag(tag, "max");
  }
  if (slug) revalidateTag(safeTag(`article:${slug}`), "max");
  for (const c of categorySlugs) revalidateTag(safeTag(`category:${c}`), "max");
}

export async function savePostAction(id: number, payload: EditorPayload): Promise<SaveResult> {
  try {
    const saved = await updatePost(id, toWrite(payload));
    // Always refresh after an update: a now-draft response may represent an
    // unpublish, and the old slug/categories are not present in the response.
    refreshPublic(saved.slug, payload.categorySlugs);
    return { ok: true, status: saved.status, slug: saved.slug };
  } catch (e) {
    if (e instanceof AdminAuthError) redirect("/login");
    return { ok: false, error: e instanceof AdminApiError ? "WordPress rejected the save. Check your permissions and try again." : "Couldn't save. Please try again." };
  }
}

export async function createPostAction(payload: EditorPayload): Promise<SaveResult> {
  try {
    const saved = await createPost(toWrite(payload));
    if (saved.status === "publish") refreshPublic(saved.slug, payload.categorySlugs);
    return { ok: true, id: saved.id, status: saved.status, slug: saved.slug };
  } catch (e) {
    if (e instanceof AdminAuthError) redirect("/login");
    return { ok: false, error: e instanceof AdminApiError ? "WordPress rejected the new article. Check your permissions and try again." : "Couldn't create the article. Please try again." };
  }
}
