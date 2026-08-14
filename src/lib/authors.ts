// Authors: the ក្រុមការងារ block on every landing page, the /author index and
// the /author/<slug> archives.
//
// All three read ONE list. They used to make three different `/wp/v2/users`
// calls — the block filtered by slug[], the archive filtered by slug, the index
// asked for everything — at ~4.2s each, on the critical path of all 11 landing
// pages and every author archive. The list is 40 rows; fetching it whole once
// and filtering here is both simpler and (with `pub-authors`) ~20x faster, and
// the three surfaces now share a single ISR cache entry.

import { apiFetch } from "./api/client";
import { fastPublicFetch, withPublicRestFallback } from "./api/fast-public";

export interface TeamMember {
  id: number;
  slug: string;
  name: string;
  /** The author's photo. */
  avatar: string;
}

interface WpUser {
  id: number;
  slug: string;
  name: string;
}

export interface AuthorProfile {
  id: number;
  slug: string;
  name: string;
  /** The author's bio, "" for most accounts. */
  description: string;
}
// No `avatar`. It carried `avatar_urls[96]` — a Gravatar URL that is an md5 of
// the author's EMAIL — and nothing ever rendered it: every author's Gravatar is
// unset (`d=mm`, the blank silhouette), so the landing block pins its own
// portraits in TEAM below. Dropping it is what lets the fast path serve this
// list without hashing emails into a public response. If a surface ever needs a
// real portrait, it lives in Simple Author Box user meta, not in a mail hash.

interface WpUserDetail extends WpUser {
  description: string;
}

const mapUser = (u: WpUserDetail): AuthorProfile => ({
  id: u.id,
  slug: u.slug,
  name: u.name,
  description: u.description ?? "",
});

/** Every author with published content, ordered by display name — WordPress's
 *  own order, reproduced in SQL on the fast path so the /author index does not
 *  reshuffle when a fallback fires.
 *
 *  `per_page=100` on both paths: the day this site has more than 100 authors,
 *  BOTH need paging.
 *
 *  THROWS. This one list answers both "who are the authors" (the /author index,
 *  where it IS the page) and "is this an author" (getAuthorBySlug, whose null
 *  the archive route turns into a 404) — cases 2 and 3 of the error-handling
 *  note in api/client.ts. Swallowing it baked "មិនអាចទាញយកបញ្ជីអ្នកនិពន្ធបានទេ"
 *  onto the index and a 404 onto all 21 archives, for an hour at a time. */
export async function fetchAuthors(): Promise<AuthorProfile[]> {
  const cache = { revalidate: 3600, tags: ["authors"] };
  return withPublicRestFallback(
    "authors",
    async () => {
      const body = await fastPublicFetch<{ data?: WpUserDetail[] }>("pub-authors", {}, cache);
      return (body.data ?? []).map(mapUser);
    },
    async () => {
      const users = await apiFetch<WpUserDetail[]>(
        "/wp/v2/users?per_page=100&_fields=id,slug,name,description",
        cache,
      );
      return users.map(mapUser);
    },
  );
}

/** The same list, degraded to [] — for the ក្រុមការងារ block (one strip on a
 *  landing page, not worth the page) and for the archive route's
 *  generateStaticParams (prebuilding nothing still renders on demand). */
export async function getAuthors(): Promise<AuthorProfile[]> {
  return fetchAuthors().catch(() => []);
}

/** One author by slug, or null (which the route turns into a 404). Reads the
 *  THROWING list: null has to mean "no such author", never "WordPress was down".
 *
 *  Filtered out of the full list rather than queried: it is the same query with
 *  the same cache tag, so a separate request bought nothing but a second ~4s
 *  round trip on every archive render. */
export async function getAuthorBySlug(slug: string): Promise<AuthorProfile | null> {
  const authors = await fetchAuthors();
  return authors.find((a) => a.slug === slug) ?? null;
}

/**
 * The five members the live block shows, in its order.
 *
 * Not `/wp/v2/users?per_page=5`: that returns whatever five sort first by name,
 * which is a different — and much longer — list than the one the site publishes.
 * The block is an editorial pick, so the picks live here.
 *
 * Confirmed 2026-08-12 against economy.ams.com.kh directly (ids 1086, 25, 13,
 * 15, 23 — matches a live screenshot of the block, same names, same order).
 * The PREVIOUS list here (triya-ams, chanreth-ams, sinvichka-ams,
 * chansreypich-ams, vanthan-ams, avatars under `/infotainment/`) was
 * infotainment.ams.com.kh's roster, not economy's — none of those slugs exist
 * on this backend, so getTeam() below silently returned [] and the block
 * always rendered empty. Same class of leftover-from-the-sister-project bug
 * as program-curation.ts's CURATED_PROGRAMS (see programs.ts).
 *
 * The photo is pinned too — no REST endpoint exposes it (WordPress serves
 * these portraits from the Simple Author Box plugin's user meta; the REST
 * user object only carries `avatar_urls`, and every one of these accounts'
 * Gravatar is unset, `d=mm`, the blank silhouette — confirmed on user 1086).
 * Sourced instead straight from the live homepage's own rendered HTML, each
 * `<img>` inside a `saboxplugin-gravatar` block next to that author's own
 * `/author/<slug>` link (confirmed 2026-08-12) — the same box the block
 * itself paints from, so these are exactly the live photos.
 */
const TEAM = [
  // លោក ហេង សុវណ្ណ | Mr. Heng Sovann
  { slug: "sovann2-ams", avatar: "https://economy.ams.com.kh/wp-content/uploads/2021/05/hengsovann-2.webp" },
  // លោក អា សុវណ្ណារ៉ា | Mr. Ea Sovannara
  { slug: "sovannara-ams", avatar: "https://s3.ams.com.kh/economy/2021/03/Ea-Sovannara-01.jpg" },
  // លោក សន សុនលី | Mr. San Sounly
  { slug: "sounly-ams", avatar: "https://s3.ams.com.kh/economy/2021/03/SAN-SOUNLY-02.jpg" },
  // លោក កែ ផុស | Mr. Ker Phors
  { slug: "phors-ams", avatar: "https://s3.ams.com.kh/economy/2020/12/KER-PHORS.jpg" },
  // កញ្ញា ម៉ាន់ ហ៊ុយលាង | Ms. Mann Huyleang
  { slug: "huyleang-ams", avatar: "https://s3.ams.com.kh/economy/2021/03/MANN-HUYLEANG.jpg" },
] as const;

/** The team block is WordPress's author list — its heading links to /author and
 *  each member links to their /author/<slug> archive, as on the live site.
 *
 *  Only the names come from WordPress, so renaming an author there still shows
 *  up here. Neither source returns them in TEAM's order — the full list is by
 *  display name — so the block is rebuilt in TEAM's order, not the list's.
 *
 *  Returns [] when the list is empty (getAuthors swallows its own errors),
 *  which renders the block empty rather than taking the landing page down. */
export async function getTeam(): Promise<TeamMember[]> {
  const bySlug = new Map((await getAuthors()).map((a) => [a.slug, a]));
  return TEAM.flatMap(({ slug, avatar }) => {
    const user = bySlug.get(slug);
    return user ? [{ id: user.id, slug, name: user.name, avatar }] : [];
  });
}
