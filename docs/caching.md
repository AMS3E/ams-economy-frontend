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

**Single Dokploy instance, no CDN in front.** The multi-instance tag
propagation Next's docs describe (`updateTags`/`refreshTags`, Redis
coordination) does not apply here — the default file-system cache handler is
authoritative for every request. `.next/cache` is the actual write target; the
Dockerfile's `runner` stage (`mkdir .next && chown nextjs:nodejs .next`,
*before* the standalone build is copied in) exists solely so that directory is
writable by the unprivileged user ISR writes as.

**Three independent cache layers**, easy to conflate:

| Layer | Where | Scope |
|---|---|---|
| Server ISR / fetch cache | `.next/cache`, this Next instance | Every visitor, until tag-busted or the 3600s window elapses |
| WordPress's own `ams-cache` plugin | WP host, separate system | `scm_preload_critical_urls()` re-warms *WordPress-rendered* pages — irrelevant to the public site, which is this frontend. See project-context.md §3 for why a WP write can take minutes because of it. Do not confuse with the frontend's ISR cache. |
| Client router cache | The visiting browser tab | `next.config.ts` `experimental.staleTimes: { dynamic: 180, static: 300 }` — only affects `<Link>` client-side navigation within one tab; a hard reload always hits the server. |

---

## 2. Timings in use

| Duration | Where | What |
|---|---|---|
| **3600s (1h)** | ~30 call sites in `src/lib/*.ts`; every page's `export const revalidate` | The house default. Every page-level `revalidate` matches its own fetches' window — keep them in sync when adding a route. |
| **86400s (24h)** | `episode.ts:37` (`fetchVimeoRunTime`), `episodes.ts:500` (inside `fetchLegacyEpisodeMedia`) | The only two calls hitting Vimeo's own oEmbed API directly, not WP. Runtime/thumbnail don't change once a video's up. |
| **180s / 300s** | `next.config.ts:15-18` `staleTimes.dynamic`/`.static` | Client router cache, not server-side — see §1. |

---

## 3. The invalidation loop, WordPress → browser

```
WP publish/unpublish/trash
  └─ transition_post_status hook (ams-frontend-api.php:819-827)
       fires only when publish is crossed either direction,
       only for post_type in {post, episode, movie, tv_show}
     └─ ams_afa_revalidate_tags($post) picks the tag list (§4)
     └─ ams_afa_ping_revalidate() — wp_remote_post, blocking:false, timeout 2s
          (never blocks the WP save)
          └─ POST /api/revalidate?secret=...&tag=X&tag=Y...
               └─ src/app/api/revalidate/route.ts checks REVALIDATE_SECRET,
                  calls revalidateTag(safeTag(tag), "max") per tag
```

**`revalidateTag(tag, "max")` does NOT regenerate anything immediately.** Per
Next 16's own docs (`node_modules/next/dist/docs/.../revalidateTag.md`): it
marks the tag's cache entries stale; fresh content is only fetched when a page
using that tag is *next visited*. That first visitor after the bust still sees
the *old* content (stale-while-revalidate) — the visitor *after* that one sees
the regenerated page. There is no proactive warm-up crawl. A low-traffic page
can sit marked-stale-but-never-regenerated indefinitely if nobody visits it.

`REVALIDATE_SECRET` (Dokploy env) must equal the WordPress-side secret in
**Settings → Frontend Cache**. A wrong secret and an unset one both 401 —
indistinguishable from outside.

---

## 4. Tag vocabulary — what WordPress sends vs. what the frontend consumes

From `ams_afa_revalidate_tags()` in `ams-frontend-api.php:773-797`:

| Post type | Tags WordPress sends |
|---|---|
| `post` | `articles`, `home`, `daily-events`, `article:<slug>`, `category:<slug>` (one per term) |
| `episode` | `episodes`, `tv-show:<show id>` |
| `movie` / `tv_show` | `program` (blanket — WP can't know the frontend's own registry slugs) |

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
- **`movie`/`tv_show` → `program` doesn't reach everything a program page
  fetches.** `getFeaturedMovie`'s background-art fetch (`programs.ts:382-388`)
  is tagged `["media", "media:<mediaId>"]`, not `"program"` — changing a
  program's hero backdrop only refreshes on the natural 1h window, never
  on-demand. Not fixable from the WP side without a separate attachment-save
  hook that doesn't exist; low-value to add (background art rarely changes).
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
   (3600 unless you have a specific reason not to, per §2).
3. Tag it with something a WordPress publish event can actually send —
   check `ams_afa_revalidate_tags()` in `ams-frontend-api.php` for what's
   available per post type before inventing a new tag name; if you need a new
   one, it has to be added on the WordPress side too or it's dead on arrival
   (see §4's `daily-events` cautionary tale).
4. Update the `/api/revalidate` doc comment's tag list if you're adding a tag.
5. If the route (or a `path`/`[...]` segment of it) isn't fully covered by
   `generateStaticParams`, add a `loading.tsx` matching the real layout, and
   consider `withMinDuration` if the fetch chain is more than one round trip.
