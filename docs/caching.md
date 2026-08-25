# The cache, end to end

Read this before touching anything that fetches WordPress data, adds a route,
or wires a new admin write. Companion to `docs/project-context.md` §5-6, which
covers the framework gotchas this doc assumes.

---

## 1. The model

**Classic ISR — `cacheComponents` is OFF** (`next.config.ts`). No Partial
Prerendering, no `'use cache'`. Every cached read is a plain `fetch(url, {
next: { revalidate, tags } })`, wrapped by `apiFetch`/`fastPublicFetch` in
`src/lib/api/`. `revalidate` must always be passed explicitly — omitting it
makes the calling route dynamic and silently defeats ISR (see the comment on
`apiFetch` in `src/lib/api/client.ts`).

**The deployment receiving the purge matters.** The Dokploy instance uses
Next's default file-system cache handler (`.next/cache`). Vercel's fetch Data
Cache is shared by deployments in the same project, but ISR page responses are
deployment/domain scoped: Vercel documents that an on-demand revalidation only
applies to the domain and deployment where it is triggered. Invalidating
Dokploy does not clear Vercel, and invalidating production does not retire a
protected preview deployment's already-rendered HTML. The webhook must target
the exact deployment visitors use.

**Three independent cache layers**, easy to conflate:

| Layer | Where | Scope |
|---|---|---|
| Server ISR / fetch cache | `.next/cache`, this Next instance | Every visitor, until tag-busted; most routes also have a 3600s fallback window, while Program routes do not |
| WordPress's own `ams-cache` plugin | WP host, separate system | `scm_preload_critical_urls()` re-warms *WordPress-rendered* pages — irrelevant to the public site, which is this frontend. See project-context.md §3 for why a WP write can take minutes because of it. Do not confuse with the frontend's ISR cache. |
| Client router cache | The visiting browser tab | `next.config.ts` `experimental.staleTimes: { dynamic: 180, static: 300 }` — only affects `<Link>` client-side navigation within one tab; a hard reload always hits the server. |

---

## 2. Timings in use

| Duration | Where | What |
|---|---|---|
| **`false` (indefinite)** | `/program` routes and their reads in `programs.ts`, `episodes.ts`, and `episode.ts` | Program pages have no timer. They remain cached until the WordPress save hook invalidates `program`, `episodes`, or a scoped show/episode tag. Vimeo metadata follows the same rule so it cannot silently lower the whole route's ISR lifetime. |
| **3600s (1h)** | Other public call sites in `src/lib/*.ts` and their pages' `export const revalidate` | The house default outside Program. Every page-level `revalidate` matches its own fetches' window — keep them in sync when adding a route. |
| **180s / 300s** | `next.config.ts:15-18` `staleTimes.dynamic`/`.static` | Client router cache, not server-side — see §1. |

---

## 3. The invalidation loop, WordPress → browser

```
WP publish/unpublish/trash
  └─ transition_post_status hook (ams-frontend-api.php)
       fires when either state is publish,
       for post_type in {post, episode, movie, tv_show, page}
     └─ ams_afa_revalidate_tags($post) picks the tag list (§4)
     └─ ams_afa_ping_revalidate() — wp_remote_post, blocking:false, timeout 2s
          (never blocks the WP save)
          └─ POST /api/revalidate?secret=...&tag=X&tag=Y...
               └─ src/app/api/revalidate/route.ts checks REVALIDATE_SECRET,
                  calls revalidateTag(safeTag(tag), { expire: 0 }) per tag
```

**`revalidateTag(tag, { expire: 0 })` expires matching data immediately but does
not proactively regenerate pages.** Per Next 16's webhook guidance, the first
visitor after the bust triggers a blocking regeneration and receives the fresh
page. A low-traffic page can therefore remain expired-but-not-regenerated until
somebody visits it, without serving its old data after that visit.

`REVALIDATE_SECRET` (frontend deployment env) must equal the WordPress-side secret in
**Settings → Frontend Cache**. A wrong secret and an unset one both 401 —
indistinguishable from outside.

---

## 4. Tag vocabulary — what WordPress sends vs. what the frontend consumes

From `ams_afa_revalidate_tags()` in `ams-frontend-api.php`:

| Post type | Tags WordPress sends |
|---|---|
| `post` | `articles`, `article`, `home`, `daily-events`, `categories`, `authors`, `author:<id>`, `article:<slug>`, `category:<slug>` (one per term) |
| `episode` | `episodes`, `authors`, `tv-show:<show id>` |
| `movie` / `tv_show` | `program`, `authors` (blanket — WP can't know the frontend's own registry slugs) |
| `page` | `pages` |

The plugin also invalidates outside post-status changes:

| WordPress event | Tags |
|---|---|
| Category create/edit/delete | `categories`, `articles`, `article` |
| User register/profile/delete | `authors`, `article` |
| Comment create/edit/delete/status transition | `comments`, `comments:<postId>` |
| Attachment add/edit/delete | `media`, `program`, `articles`, `article` |
| Navigation menu/menu-item create/edit/delete | `menu` (one shutdown ping per request) |

The blanket tags are a correctness boundary, not accidental duplication.
`transition_post_status` can run before a REST request has applied terms/meta,
and it only exposes the new slug. `articles` covers old/new list membership;
`article` retires old-slug detail entries; `categories` and `authors` refresh
the route registries and counts.

Every frontend fetch's tags, by lib file (not exhaustive — grep `tags:` in
`src/lib/**` for the full set): `articles`, `home`, `popular-articles`,
`category:<slug>`, `category-ids:<ids>`, `article`, `article:<slug>`,
`comments`, `comments:<postId>`, `authors`, `author:<id>`, `categories`,
`pages`, `page:<path>`, `episodes`, `episode:<id>`, `tv-show:<id>`, `program`,
`program:<slug>`, `program-registry`, `featured-program`, `media`,
`media:<id>`.

**Known dead/gap wiring — confirmed from both sides, not just the frontend:**

- **`daily-events`** — WordPress sends it on every article publish; no fetch
  anywhere in `src/lib` has ever produced a cache entry tagged `daily-events`.
  Harmless: the same publish also sends `home`, which is what the daily-events
  widget's own fetch is actually tagged with (`home-data.ts` →
  `["articles","home"]`). Two systems agree the tag exists; neither is wired
  to the other.
- The `/api/revalidate` route's own doc comment lists the tag vocabulary it
  expects — keep it in sync when a call site's tags change.

---

## 5. Prebuild coverage — what's static vs. rendered on first hit

`generateStaticParams()` coverage varies a lot by route, and it's the single
biggest factor in how slow a *first* visit to a URL is:

| Route | Prebuild | First-hit cost if not prebuilt |
|---|---|---|
| Category listings, page 1 | All 26 terms | — |
| Category listings, page 2+ | **Not prebuilt** | One `fetchArticleList` round trip, gated cheaply first via `categoryMaxPages()` (no extra fetch) |
| Homepage pager | Pages 1-5 | n≥6: one round trip (slices the same 5-page block page 1 already cached) |
| Author archives, page 1 | All authors | — |
| Author archives, page 2+ | **Not prebuilt** | One `fetchAuthorPosts` round trip, no cheap gate — a bad page number pays for the fetch before 404ing |
| `/program/<slug>` overview | All known programs | New program: full `getProgramWatchData()` chain (see below) |
| `/program/<slug>/<episode>` | **`generateStaticParams` returns `[]` — literally none** | **Every single episode, every time**, until that specific URL has been visited once |

`getProgramWatchData()` (`src/lib/khmer-insider.ts:59-116`, used by both the
program overview and the episode routes — every WordPress Program uses the
`KhmerInsiderWatchPage` template now) is not one fetch: `routedProgram()`
serially, then a `Promise.all` of 3 (one of which, `getProgram()`, is itself
another internal `Promise.all`), then — if an episode matched — a second
serial `Promise.all` of 2. At WP's documented ~3.9s fixed overhead per REST
call (project-context.md §4), a cold hit is close to 8s, roughly double an
article page's ~4s.

**Pattern for routes that render on first hit:** pair a `loading.tsx` that
mirrors the real component's geometry (no layout shift on swap) with
`withMinDuration()` (`src/lib/timing.ts`) wrapping the slow fetch, so the
skeleton has an honest floor (currently 400ms) and doesn't flash on a lucky
fast resolve. See `src/components/program/WatchPageSkeleton.tsx`, shared by
both `program/[slug]/(overview)/loading.tsx` and
`program/[slug]/[episode]/loading.tsx` — keep them sharing it; the two routes
render the exact same component. This floor only ever applies while the page
component actually executes (first visit, or a background ISR regen) — once a
route is served straight from a warm cache, its Server Component doesn't run
again, so there's nothing to delay on that path, which is correct: a
genuinely cached hit doesn't need one.

**The 200+`noindex` tradeoff.** Once a route has a `loading.tsx`, HTTP status
can no longer report `notFound()` for that segment — streaming commits the
response before `notFound()` can fire, so an unknown slug answers 200 with
`<meta name="robots" content="noindex">` instead of a real 404. Calibrate by
comparing response BODY on a known-good vs. known-missing path in the same
run, not status code (see project-context.md §5). Accepted deliberately on
every route that has one — the alternative is a multi-second frozen page with
zero feedback on every real click.

---

## 6. Adding a new cached read — checklist

1. Route through `apiFetch`/`fastPublicFetch` with explicit `{ revalidate,
   tags }`. Never a bare `fetch`.
2. Match the page's `export const revalidate` to the fetch's `revalidate`
   (3600 by default; `false` throughout Program routes, per §2).
3. Tag it with something a WordPress publish event can actually send —
   check `ams_afa_revalidate_tags()` in `ams-frontend-api.php` for what's
   available per post type before inventing a new tag name; if you need a new
   one, it has to be added on the WordPress side too or it's dead on arrival
   (see §4's `daily-events` cautionary tale).
4. Update the `/api/revalidate` doc comment's tag list if you're adding a tag.
5. If the route (or a `path`/`[...]` segment of it) isn't fully covered by
   `generateStaticParams`, add a `loading.tsx` matching the real layout, and
   consider `withMinDuration` if the fetch chain is more than one round trip.
