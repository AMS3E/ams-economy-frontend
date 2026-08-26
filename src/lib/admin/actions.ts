"use server";

// Server Actions for the article editor. The editor (a Client Component) calls
// these with a structured payload; they write through core wp/v2/posts as the
// logged-in user and report a typed result the editor can render.

import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { updatePost, createPost, getPostForEdit, getPostForEditBySlug, type PostWrite, type EditablePost, type SavedPost } from "./post-edit";
import { AdminAuthError, AdminApiError } from "./client";
import { safeTag } from "@/lib/api/client";
import { decodeEntities } from "@/lib/api/mappers";

/** The editable field set. Sent whole; the layer forwards it to WordPress. */
export interface EditorPayload {
  title: string;
  /** Body HTML from the TipTap editor. ABSENT (undefined) when the user never
   *  touched the body — the write then omits `content` entirely so an existing
   *  Gutenberg body is not flattened by a metadata-only save. */
  content?: string;
  excerpt: string;
  status: string; // "draft" | "pending" | "publish"
  /** The URL slug, hand-written in English (site convention — WordPress would
   *  percent-encode the Khmer title). OMITTED when locked (the article has
   *  been published; a live URL is never rewritten) or left blank (WordPress
   *  generates one). WP sanitizes whatever is sent. */
  slug?: string;
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
  /** Post template — the theme file that renders the article's TAIL on the
   *  WordPress site. "" is WordPress's "Default template", which on this theme
   *  means nothing renders below the body, so it is a real choice and is always
   *  sent rather than omitted when empty. */
  template: string;
  seo: { title: string; description: string; focus: string };
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  /** Present on success — the saved status/slug echoed back from WordPress. */
  status?: string;
  slug?: string;
  /** The permalink WordPress computed for the saved state — on a publish, the
   *  article's live URL. Feeds the editor's preview control. */
  link?: string;
  /** New post id, on a successful create. */
  id?: number;
}

function toWrite(p: EditorPayload): PostWrite {
  return {
    title: p.title,
    ...(p.content !== undefined ? { content: p.content } : {}),
    ...(p.slug !== undefined ? { slug: p.slug } : {}),
    excerpt: p.excerpt,
    status: p.status,
    categories: p.categories,
    tags: p.tags,
    featured_media: p.featuredMedia,
    password: p.password,
    sticky: p.sticky,
    template: p.template,
    meta: {
      _yoast_wpseo_title: p.seo.title,
      _yoast_wpseo_metadesc: p.seo.description,
      _yoast_wpseo_focuskw: p.seo.focus,
    },
  };
}

function postWanted(p: EditorPayload) {
  return {
    title: p.title,
    excerpt: p.excerpt,
    status: p.status,
    categories: p.categories,
    tags: p.tags,
    featuredMedia: p.featuredMedia,
    password: p.password,
    sticky: p.sticky,
    template: p.template,
    seo: p.seo,
  };
}
type PostWanted = ReturnType<typeof postWanted>;

function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/** Did WordPress persist every field from a post save that failed to answer
 *  before our deadline? Mirrors episodeSaveLanded in program-actions.ts —
 *  published-post hooks on this host can keep the REST request open long
 *  after core has committed the post and meta. `content` is deliberately NOT
 *  compared: WordPress can reformat stored HTML (wpautop, block validation),
 *  so an exact match is unreliable and a false mismatch here only costs a
 *  harmless re-save (unlike a false mismatch on create, which would mint a
 *  duplicate). */
function postSaveLanded(stored: EditablePost | null, wanted: PostWanted): boolean {
  const text = (v: string) => decodeEntities(v).trim();
  return Boolean(
    stored &&
      text(stored.title) === text(wanted.title) &&
      text(stored.excerpt) === text(wanted.excerpt) &&
      stored.status === wanted.status &&
      sameIdSet(stored.categoryIds, wanted.categories) &&
      sameIdSet(
        stored.tags.map((t) => t.id),
        wanted.tags,
      ) &&
      stored.featuredMedia === wanted.featuredMedia &&
      stored.password === wanted.password &&
      stored.sticky === wanted.sticky &&
      stored.template === wanted.template &&
      text(stored.seo.title) === text(wanted.seo.title) &&
      text(stored.seo.description) === text(wanted.seo.description) &&
      text(stored.seo.focus) === text(wanted.seo.focus),
  );
}

function postMismatchFields(stored: EditablePost | null, wanted: PostWanted): string {
  if (!stored) return "record unavailable";
  const text = (v: string) => decodeEntities(v).trim();
  const fields = [
    text(stored.title) !== text(wanted.title) ? "title" : "",
    text(stored.excerpt) !== text(wanted.excerpt) ? "excerpt" : "",
    stored.status !== wanted.status ? "status" : "",
    !sameIdSet(stored.categoryIds, wanted.categories) ? "categories" : "",
    !sameIdSet(
      stored.tags.map((t) => t.id),
      wanted.tags,
    )
      ? "tags"
      : "",
    stored.featuredMedia !== wanted.featuredMedia ? "featured image" : "",
    stored.password !== wanted.password ? "password" : "",
    stored.sticky !== wanted.sticky ? "sticky" : "",
    stored.template !== wanted.template ? "template" : "",
    text(stored.seo.title) !== text(wanted.seo.title) ||
    text(stored.seo.description) !== text(wanted.seo.description) ||
    text(stored.seo.focus) !== text(wanted.seo.focus)
      ? "SEO"
      : "",
  ].filter(Boolean);
  return fields.join(", ") || "unknown";
}

/** A timed-out POST can finish committing just after the abort reaches Node.
 *  Poll the uncached record briefly instead of sampling once and reporting a
 *  false failure because of that race — same recovery window as
 *  confirmEpisodeSave in program-actions.ts. */
async function confirmPostSave(
  read: () => Promise<EditablePost | null>,
  wanted: PostWanted,
): Promise<{ landed: boolean; stored: EditablePost | null }> {
  const deadline = Date.now() + 45_000;
  let stored: EditablePost | null = null;
  do {
    stored = await read().catch(() => null);
    if (postSaveLanded(stored, wanted)) return { landed: true, stored };
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 750));
  } while (Date.now() < deadline);
  return { landed: false, stored };
}

/** Publishing/updating from the dashboard refreshes exactly the public pages
 *  the post appears on — its own page, its categories' lists, the homepage and
 *  the day tabs — instead of the blanket "articles" tag (every list page at
 *  once), to stay friendly to the Vercel ISR-writes budget. Mirrors the tag
 *  set the WP plugin's publish webhook (≥1.7.3) sends for a post. */
function refreshPublic(status: string | undefined, slug: string | undefined, categorySlugs: string[]) {
  if (status !== "publish") return;
  revalidateTag("home", "max");
  revalidateTag("daily-events", "max");
  if (slug) revalidateTag(safeTag(`article:${slug}`), "max");
  for (const c of categorySlugs) revalidateTag(safeTag(`category:${c}`), "max");
}

export async function savePostAction(id: number, payload: EditorPayload): Promise<SaveResult> {
  const wanted = postWanted(payload);
  try {
    let saved: SavedPost;
    try {
      saved = await updatePost(id, toWrite(payload));
    } catch (e) {
      // The same host behavior handled for episodes: WP commits the write,
      // then slow publish/cache hooks outlive the short acknowledgement
      // deadline. Re-read the uncached edit record and trust stored state
      // over a missing HTTP response. A mismatch remains a real error.
      const confirmed = await confirmPostSave(() => getPostForEdit(id), wanted);
      if (!confirmed.landed || !confirmed.stored) {
        console.warn(`[savePost] ${id} recovery mismatch: ${postMismatchFields(confirmed.stored, wanted)}`);
        throw e;
      }
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.warn(`[savePost] ${id}: ${msg}, but every requested field is stored — treating as success.`);
      saved = { id: confirmed.stored.id, status: confirmed.stored.status, slug: confirmed.stored.slug, link: confirmed.stored.link };
    }
    refreshPublic(saved.status, saved.slug, payload.categorySlugs);
    return { ok: true, status: saved.status, slug: saved.slug, link: saved.link };
  } catch (e) {
    if (e instanceof AdminAuthError) redirect("/login");
    if (e instanceof AdminApiError) return { ok: false, error: "WordPress rejected the save. Check your permissions and try again." };
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.warn(`[savePost] ${id}: ${msg}`);
    return { ok: false, error: `Couldn't save — ${msg}` };
  }
}
export async function createPostAction(payload: EditorPayload): Promise<SaveResult> {
  const wanted = postWanted(payload);
  // A hand-written slug is the only deterministic key a retry can recover
  // by (see getPostForEditBySlug) — a blank slug lets WordPress derive its
  // own from the title, which this can't predict, so a create with no slug
  // gets the short write timeout but no idempotency check or recovery poll.
  const slug = (payload.slug ?? "").trim();
  try {
    if (slug) {
      // A previous attempt may have committed and then timed out. Do this
      // idempotency check before POST so pressing Save again cannot mint a
      // second post with WordPress's automatic "-2" slug suffix.
      const existing = await getPostForEditBySlug(slug);
      if (existing) {
        if (postSaveLanded(existing, wanted)) {
          refreshPublic(existing.status, existing.slug, payload.categorySlugs);
          return { ok: true, id: existing.id, status: existing.status, slug: existing.slug, link: existing.link };
        }
        return { ok: false, error: `An article with the slug "${slug}" already exists with different details. Edit that article instead.` };
      }
    }

    let saved: SavedPost;
    try {
      saved = await createPost(toWrite(payload));
    } catch (e) {
      if (!slug) throw e;
      const confirmed = await confirmPostSave(() => getPostForEditBySlug(slug), wanted);
      if (!confirmed.landed || !confirmed.stored) {
        console.warn(`[createPost] recovery mismatch: ${postMismatchFields(confirmed.stored, wanted)}`);
        throw e;
      }
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.warn(`[createPost] ${confirmed.stored.id}: ${msg}, but every requested field is stored — treating as success.`);
      saved = { id: confirmed.stored.id, status: confirmed.stored.status, slug: confirmed.stored.slug, link: confirmed.stored.link };
    }
    refreshPublic(saved.status, saved.slug, payload.categorySlugs);
    return { ok: true, id: saved.id, status: saved.status, slug: saved.slug, link: saved.link };
  } catch (e) {
    if (e instanceof AdminAuthError) redirect("/login");
    if (e instanceof AdminApiError) return { ok: false, error: "WordPress rejected the new article. Check your permissions and try again." };
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.warn(`[createPost] ${msg}`);
    return { ok: false, error: `Couldn't create the article — ${msg}` };
  }
}
