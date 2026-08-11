// Single-post read + write for the article editor. Reads with context=edit (so
// title/excerpt come back as raw source and Yoast meta is included) and writes
// back through core wp/v2/posts as the logged-in user.
//
// Scope: title, body, excerpt, status, categories, tags, featured image, and
// Yoast SEO. The body is written as static HTML from the TipTap editor — for a
// post whose stored body is Gutenberg block markup (<!-- wp:… -->) that save
// flattens the blocks, so callers only include `content` when the user actually
// edited the body (dirty-tracking lives in BodyEditor/ArticleEditor).

import { adminFetch } from "./client";
import { decodeEntities } from "@/lib/api/mappers";

interface RawEditPost {
  id: number;
  slug: string;
  status: string;
  title: { raw?: string; rendered?: string };
  content: { raw?: string; rendered?: string };
  excerpt: { raw?: string; rendered?: string };
  categories: number[];
  tags: number[];
  featured_media: number;
  password?: string;
  sticky?: boolean;
  meta?: Record<string, unknown>;
  _embedded?: {
    "wp:featuredmedia"?: {
      source_url?: string;
      media_details?: { sizes?: { medium?: { source_url?: string }; thumbnail?: { source_url?: string } } };
    }[];
    "wp:term"?: { id: number; taxonomy: string; name: string }[][];
  };
}

export interface EditablePost {
  id: number;
  title: string;
  /** Rendered HTML — do_blocks() output. Kept for previews and for the legacy
   *  TipTap editor; NOT what the Gutenberg canvas loads. */
  bodyHtml: string;
  /** The STORED body: block markup with `<!-- wp:… -->` delimiters. This is
   *  what the Gutenberg editor parses and what it serializes back, so a body
   *  save round-trips instead of flattening. */
  bodyRaw: string;
  excerpt: string;
  slug: string;
  status: string;
  categoryIds: number[];
  tags: { id: number; name: string }[];
  featuredMedia: number;
  featuredThumb: string;
  /** Present only under context=edit. A protected post returns its real
   *  password here, which is why this whole object is admin-only. */
  password: string;
  sticky: boolean;
  seo: { title: string; description: string; focus: string };
}

/** The fields the editor may write. Everything optional — send only what changed.
 *  `content` in particular must be OMITTED (not "") unless the body was edited. */
export interface PostWrite {
  title?: string;
  content?: string;
  excerpt?: string;
  status?: string;
  slug?: string;
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  meta?: Record<string, string>;
  /** Visibility. Empty string CLEARS a password — WordPress treats the field as
   *  set-or-clear, so it must be sent as "" rather than omitted to unprotect. */
  password?: string;
  sticky?: boolean;
}

function metaStr(meta: Record<string, unknown> | undefined, key: string): string {
  const v = meta?.[key];
  return typeof v === "string" ? v : "";
}

export async function getPostForEdit(id: number): Promise<EditablePost | null> {
  const { data } = await adminFetch<RawEditPost>(`/wp/v2/posts/${id}`, {
    query: {
      context: "edit",
      _fields: "id,slug,status,title,content,excerpt,categories,tags,featured_media,password,sticky,meta,_links,_embedded",
      _embed: "wp:featuredmedia,wp:term",
    },
  });
  if (!data?.id) return null;

  const media = data._embedded?.["wp:featuredmedia"]?.[0];
  const terms = (data._embedded?.["wp:term"] ?? []).flat();

  return {
    id: data.id,
    title: decodeEntities(data.title?.raw ?? "").trim(),
    bodyHtml: data.content?.rendered ?? "",
    bodyRaw: data.content?.raw ?? "",
    excerpt: decodeEntities(data.excerpt?.raw ?? "").trim(),
    slug: data.slug ?? "",
    status: data.status,
    password: typeof data.password === "string" ? data.password : "",
    sticky: data.sticky === true,
    categoryIds: data.categories ?? [],
    tags: terms
      .filter((t) => t.taxonomy === "post_tag")
      .map((t) => ({ id: t.id, name: decodeEntities(t.name).trim() })),
    featuredMedia: data.featured_media ?? 0,
    featuredThumb:
      media?.media_details?.sizes?.medium?.source_url ??
      media?.media_details?.sizes?.thumbnail?.source_url ??
      media?.source_url ??
      "",
    seo: {
      title: metaStr(data.meta, "_yoast_wpseo_title"),
      description: metaStr(data.meta, "_yoast_wpseo_metadesc"),
      focus: metaStr(data.meta, "_yoast_wpseo_focuskw"),
    },
  };
}

/** Update an existing post. WordPress accepts POST on the item route as an update.
 *
 *  ONE WRITE, except for a single measured exception: WordPress validates an
 *  incoming `password` against the STORED sticky flag (`is_sticky($post_id)`),
 *  not against the `sticky` in the same request. Measured on live production —
 *
 *    POST {status:"draft", password:"x", sticky:false} on a sticky post
 *      -> 400 rest_invalid_field "A sticky post can not be password protected."
 *    POST {sticky:false} then the IDENTICAL payload
 *      -> 200, and the post ends up draft + protected + unsticky
 *
 *  — so a rejected write loses every other edit in the payload (title, body,
 *  categories, SEO), which is what makes this worth a second round trip rather
 *  than a comment. It only fires when a password is actually being set. */
export async function updatePost(id: number, patch: PostWrite): Promise<{ id: number; status: string; slug: string }> {
  if (patch.password && patch.sticky === false) {
    await adminFetch(`/wp/v2/posts/${id}`, { method: "POST", body: { sticky: false } });
  }
  const { data } = await adminFetch<{ id: number; status: string; slug: string }>(`/wp/v2/posts/${id}`, {
    method: "POST",
    body: patch,
  });
  return data;
}

/** Create a new post. Defaults to draft unless the caller sets a status. */
export async function createPost(fields: PostWrite): Promise<{ id: number; status: string; slug: string }> {
  const { data } = await adminFetch<{ id: number; status: string; slug: string }>(`/wp/v2/posts`, {
    method: "POST",
    body: { status: "draft", ...fields },
  });
  return data;
}
