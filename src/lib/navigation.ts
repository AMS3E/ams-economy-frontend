// Header navigation + program data.
//
// This is REAL data pulled from the live WordPress site (labels, links, and
// CDN image URLs), shaped like a future CMS/API response. The pills and the
// icon strip stay curated constants (their gradients/icons are design assets,
// not CMS data); the poster list is curated too but auto-appends new published
// programs on the all-programs surfaces — see getFeaturedPrograms.
//
// NO top-level import of the data layer here: MobileNav (a Client Component)
// value-imports PROGRAM_ICON_LABEL from this module, so a static import of
// programs.ts would drag the whole fetch layer into the client bundle. The
// registry is loaded lazily inside the one server-only function that needs it.

// ─── Colored pill menu (top-right of the header bar) ──────────────────────────

/** `slug` keys into the program registry — see src/lib/programs.ts, which owns
 *  the WordPress ids and the canonical URLs.
 *
 *  `background` is a full CSS background value, not a color: each pill is a
 *  gradient. It is applied inline in SiteHeader — Panda compiles its styles at
 *  build time, so a value coming from data cannot go through `css()`. */
export interface NavPill {
  label: string;
  background: string;
  slug: string;
}

// The pills are painted on the dark top bar, and each program owns its own
// gradient. The angles are per-program and deliberate — they are not a series.
const NAV_PILLS: NavPill[] = [
  { label: "បើកសោជីវិត", background: "linear-gradient(168deg, #e67e22 0%, #e74c3c 100%)", slug: "unlock-the-life" },
  { label: "ចង់ដឹងរឿងគេ", background: "linear-gradient(105deg, #8e44ab 0%, #5e2b72 100%)", slug: "reaction" },
  { label: "វនយាត្រា", background: "linear-gradient(124deg, #28a35b 0%, #0f4c1d 100%)", slug: "vanna-yeatra" },
  { label: "Cicada Agent", background: "linear-gradient(135deg, #0bb6aa 0%, #2cb5e8 100%)", slug: "cicada-agent" },
  {
    label: "ព្រះនាងកង្កែប",
    background: "linear-gradient(90deg, rgba(145,145,145,1) 0%, rgba(184,184,184,1) 0%, rgba(156,156,156,1) 100%)",
    slug: "ladyfrog",
  },
];

export async function getNavPills(): Promise<NavPill[]> {
  return NAV_PILLS;
}

// ─── Digital-content icon strip (row below the main nav) ──────────────────────

export interface ProgramIcon {
  title: string;
  image: string;
  slug: string;
}

/** Label that introduces the icon strip ("Digital content:"). */
export const PROGRAM_ICON_LABEL = "មាតិកាឌីជីថល:";

// The titles are live's own menu labels, byte for byte (the strip's markup
// carries them in `.menu-image-title` spans). Seven of these used to be English
// or a different word — "Green Box" for ប្រអប់បៃតង, "អូបសុខ" for អផ្សុក.
const PROGRAM_ICONS: ProgramIcon[] = [
  { title: "Learn The World", image: "https://s3.ams.com.kh/infotainment/2025/11/01_LNTW_PWPF-21x36.jpg", slug: "learn-the-world" },
  { title: "ជ្រុងមួយនៃភ្នំពេញ", image: "https://s3.ams.com.kh/infotainment/2025/08/05_CNPS01_LDSM-01-1-36x36.jpg", slug: "jroung-phnom-penh" },
  { title: "អាថ៌កំបាំងក្រោមមេឃ", image: "https://s3.ams.com.kh/infotainment/2025/03/01_MYSSO1_PICN-48x48.png", slug: "athkombang-krom-mekh" },
  { title: "អូនខ្លាច", image: "https://s3.ams.com.kh/infotainment/2025/03/01_FECUS01_PICN-48x48.png", slug: "oun-khlach" },
  { title: "មេនាំរឿង", image: "https://s3.ams.com.kh/infotainment/2025/03/01_MOTS01_ICOS.svg", slug: "me-noam-rueng" },
  { title: "Daily Feed", image: "https://s3.ams.com.kh/infotainment/2023/07/01_DAILY-FEEDS2_H28.svg", slug: "daily-feed" },
  { title: "The Fact", image: "https://s3.ams.com.kh/infotainment/2023/07/01_THE1.svg", slug: "the-fact" },
  { title: "១នាទីដើម្បីសុខភាព", image: "https://s3.ams.com.kh/infotainment/2022/09/WEB-ICON-1MIN_02.svg", slug: "1-minute-for-health" },
  { title: "អផ្សុក", image: "https://s3.ams.com.kh/infotainment/2022/09/WEB-ICON-OBSOK_02.svg", slug: "obsok" },
  { title: "ប្រអប់បៃតង", image: "https://s3.ams.com.kh/infotainment/2022/09/WEB-ICON-GREENBOX_02.svg", slug: "green-box" },
  { title: "ពិតអត់", image: "https://s3.ams.com.kh/infotainment/2022/09/WEB-ICON-FAC-CHECK_03.svg", slug: "fact-check" },
  { title: "ស្តូឌីយូ១១", image: "https://s3.ams.com.kh/infotainment/2022/09/WEB-ICON-STDUIO-11_02.svg", slug: "studio-11" },
  { title: "តាមចិត្តម៉ូម៉ូ", image: "https://s3.ams.com.kh/infotainment/2022/09/TAMCHET-MOMO_LOGO_WEB-02.svg", slug: "tamchet-momo" },
];

/**
 * The icon strip, from the CMS.
 *
 * This is WordPress's "AMS Infotainment Third Menu", the same menu the old
 * theme renders and the same one the dashboard's Menus screen edits — so an
 * editor's change lands on both sites. Core REST cannot serve it (both
 * /wp/v2/menus and /wp/v2/menu-items answer 401 to anonymous callers, measured
 * 2026-08-05), so the read goes through the fast path's pub-menu resource.
 *
 * The hardcoded list below stays as the fallback, and it is not dead weight:
 * until plugin v1.5.0 is deployed, pub-menu 404s and this returns the constant
 * — which is exactly what the site rendered before. Worth knowing when
 * comparing the two: the LIVE menu carries 14 items, the constant 13. The
 * missing one is ស្ថាបត្យកម្មសកល (global_architecture, added 2026-07), which
 * has been on the WordPress site and absent here ever since — the strip going
 * live-driven fixes that by itself.
 */
export async function getProgramIcons(): Promise<ProgramIcon[]> {
  try {
    // Both imports are lazy for the reason in this file's header: MobileNav is
    // a Client Component that value-imports PROGRAM_ICON_LABEL from here, and
    // a top-level import would ship the fetch layer (and the curated table) to
    // the browser with it.
    const [{ fastPublicFetch }, { CURATED_PROGRAMS }] = await Promise.all([
      import("./api/fast-public"),
      import("./program-curation"),
    ]);
    const env = await fastPublicFetch<{ data: { items: FastMenuItem[] } }>(
      "pub-menu",
      { menu: "ams-infotainment-third-menu" },
      { revalidate: 3600, tags: ["menu", "navigation"] },
    );
    const icons = (env.data?.items ?? [])
      .map((item) => toProgramIcon(item, CURATED_PROGRAMS))
      .filter((i): i is ProgramIcon => i !== null);
    // An empty menu is far more likely to be a bad read than a deliberate
    // clearing of the strip, so keep the known-good list in that case.
    return icons.length ? icons : PROGRAM_ICONS;
  } catch {
    return PROGRAM_ICONS;
  }
}

/** One pub-menu row. `images` is keyed by the meta key the icon was found
 *  under — see the resource's header comment for why the key is discovered
 *  rather than named. (Measured on live: the key is `_thumbnail_id`. The
 *  plugin stores the icon as the menu item's featured image.) */
interface FastMenuItem {
  id: number;
  title: string;
  url: string;
  order: number;
  meta?: Record<string, string>;
  images?: Record<string, { source_url?: string; sizes?: Record<string, { source_url?: string }> }>;
}

/** A menu row mapped onto the strip's shape, or null if it carries no icon
 *  (the strip is icons — a row without one has nothing to render). */
function toProgramIcon(item: FastMenuItem, curated: CuratedLike[]): ProgramIcon | null {
  const image = firstIconUrl(item.images, item.meta?.["_menu_item_image_size"]);
  if (!image) return null;
  return { title: item.title, image, slug: slugFromMenuUrl(item.url, curated) };
}

/** Just the two fields the URL match needs, so this module doesn't depend on
 *  the full CuratedProgram shape. */
interface CuratedLike {
  slug: string;
  wpHref: string;
}

/**
 * The icon URL, at the rendition the LIVE THEME renders it at.
 *
 * `_menu_item_image_size` is the menu-image plugin's own per-item setting and
 * takes the name of a registered size (`menu-36x36`, `menu-48x48`) or `full`.
 * Honouring it is not a nicety: without it a 36px slot loads the original —
 * one of these is a 2251×2250 JPEG.
 *
 * Verified against the hardcoded strip below, which was transcribed off live's
 * markup independently: this rule reproduces all 13 of its URLs byte for byte,
 * including the portrait one where `menu-36x36` yields `-21x36` (the size NAME
 * is a bounding box; the FILE is named for the fitted result). SVGs carry size
 * entries that all point back at the same file, so they are unaffected either
 * way, and `full` simply has no entry — hence the fallthrough.
 */
function firstIconUrl(images: FastMenuItem["images"], sizeName?: string): string {
  for (const entry of Object.values(images ?? {})) {
    const sized = sizeName ? entry?.sizes?.[sizeName]?.source_url : undefined;
    if (sized) return sized;
    if (entry?.source_url) return entry.source_url;
  }
  return "";
}

/**
 * Our route slug for a menu item's WordPress URL.
 *
 * The menu links to live WordPress pages, whose paths are inconsistent
 * (`/program/digital/obsok/`, `/movie/program-digital-oun-khlach/`,
 * `/program/learn/theworld`). CURATED_PROGRAMS already pins each of those to
 * our slug via `wpHref` — that table exists precisely because these URLs do
 * not reduce to a slug by rule. Match on it first; fall back to the last path
 * segment for a program added after the table was written.
 */
function slugFromMenuUrl(url: string, curated: CuratedLike[]): string {
  const path = (u: string) => u.replace(/^https?:\/\/[^/]+/, "").replace(/\/+$/, "");
  const target = path(url);
  const hit = curated.find((p) => path(p.wpHref) === target);
  if (hit) return hit.slug;
  return target.split("/").filter(Boolean).pop() ?? "";
}

// ─── Program posters ─────────────────────────────────────────────────────────

/** `slug` must exist in the program registry (src/lib/programs.ts) — these
 *  posters link to /program/<slug>. */
export interface FeaturedProgram {
  slug: string;
  title: string;
  year: string;
  image: string;
  href?: string;
}

/**
 * Every AMS program that has poster art, in the order WordPress lists them.
 *
 * ONE list, because live drives every poster slot on the site from one ordered
 * set and simply cuts it at a different length per slot — the counts nest
 * exactly: 8 ⊂ 9 ⊂ 15 ⊂ 18 ⊂ 20. So each surface takes a PREFIX of this array
 * (see POSTER_COUNT) rather than owning its own list.
 *
 * This used to hold nine, which is why the poster carousel showed half the
 * programs it should and why the two ranked lists below it were identical to
 * each other where live's differ. The nine were, by coincidence, exactly live's
 * ranked list — the longer slots were never modelled at all.
 *
 * The posters are the CMS's `-300x450` rendition (a 2x of the base -150x225
 * crop): correctly framed, and sharp at the 224px the carousel renders them at.
 * The full-size originals are a taller aspect and mis-crop.
 */
const PROGRAM_POSTERS: FeaturedProgram[] = [
  { slug: "learn-the-world", title: "Learn The World", year: "2025", image: "https://s3.ams.com.kh/infotainment/2025/11/01_LNTW_PWPF-300x450.jpg" },
  { slug: "jroung-phnom-penh", title: "ជ្រុងមួយនៃភ្នំពេញ", year: "2025", image: "https://s3.ams.com.kh/infotainment/2025/08/Program-Web-Profile-3-300x450.jpg" },
  { slug: "klib-sne", title: "ក្លឹបស្នេហ៍", year: "2025", image: "https://s3.ams.com.kh/infotainment/2025/02/01_CSNS01_PWPF-300x450.jpg" },
  { slug: "me-noam-rueng", title: "មេនាំរឿង", year: "2025", image: "https://s3.ams.com.kh/infotainment/2025/02/01_MOTS01_PWPF-3-300x450.jpg" },
  { slug: "athkombang-krom-mekh", title: "អាថ៌កំបាំងក្រោមមេឃ", year: "2023", image: "https://s3.ams.com.kh/infotainment/2025/02/01_MYSSO2_PWPF-300x450.jpg" },
  { slug: "oun-khlach", title: "អូនខ្លាច", year: "2024", image: "https://s3.ams.com.kh/infotainment/2024/10/01_FECUS01_PWPF-300x450.jpg" },
  { slug: "daily-feed", title: "កម្សាន្តខ្លីៗ", year: "2022", image: "https://s3.ams.com.kh/infotainment/2023/01/01_DAFS02_PWPRO-300x450.jpg" },
  { slug: "the-fact", title: "រឿងពិត", year: "2022", image: "https://s3.ams.com.kh/infotainment/2023/01/01_EPW2-300x450.jpg" },
  { slug: "tamchet-momo", title: "តាមចិត្ត MoMo", year: "2022", image: "https://s3.ams.com.kh/infotainment/2022/05/02_TAM_CHETMOMO_WEB-PROFILE-300x450.jpg" },
  // ── everything below here was missing entirely ──
  { slug: "cicada-agent", title: "ភាពយន្តកំប្លែង Cicada Agent", year: "2022", image: "https://s3.ams.com.kh/infotainment/2022/04/01_CICADA-AGENT_WEB-PROFILE-300x450.jpg" },
  { slug: "ladyfrog", title: "ព្រះនាងកង្កែប", year: "2023", image: "https://s3.ams.com.kh/infotainment/2022/03/04_PRINCE-LADY-FROG-WEB-PROFILE-300x450.jpg" },
  // The poster comes from vanna-yeatra's MOVIE post (20275). The registry points
  // /program/vanna-yeatra at its TV_SHOW post (14450) — the only program on the
  // site that has both, and the two carry different art.
  { slug: "vanna-yeatra", title: "វនយាត្រា", year: "2023", image: "https://s3.ams.com.kh/infotainment/2021/10/04_Vanayatra-profile-300x450.jpg" },
  { slug: "kalai-mode", title: "កាឡៃម៉ូដ", year: "2021", image: "https://s3.ams.com.kh/infotainment/2021/10/Kalai-mod-V2.2-300x450.jpg" },
  { slug: "reaction", title: "ចង់ដឹងរឿងគេ", year: "2021", image: "https://s3.ams.com.kh/infotainment/2021/09/05_REACTION_WEB-PROFILE-300x450.jpg" },
  { slug: "green-box", title: "ប្រអប់បៃតង", year: "2021", image: "https://s3.ams.com.kh/infotainment/2021/09/Green-Box-V2..1jpg-300x450.jpg" },
  { slug: "1-minute-for-health", title: "១នាទីដើម្បីសុខភាព និងសម្រស់", year: "2021", image: "https://s3.ams.com.kh/infotainment/2021/09/02_1MN_FOR_HEALTH_PROFILE-Color-version_SEP-22-300x450.jpg" },
  { slug: "studio-11", title: "Studio 11", year: "2021", image: "https://s3.ams.com.kh/infotainment/2021/09/STUDIO-11-V2-1-300x450.jpg" },
  { slug: "obsok", title: "អផ្សុក", year: "2021", image: "https://s3.ams.com.kh/infotainment/2021/09/OBSOK_Profile_3D_01-300x450.jpeg" },
  { slug: "fact-check", title: "ពិតអត់", year: "2021", image: "https://s3.ams.com.kh/infotainment/2021/09/Fact-check-V2.1-300x450.jpg" },
  { slug: "unlock-the-life", title: "បើកសោជីវិត", year: "2021", image: "https://s3.ams.com.kh/infotainment/2021/09/02_UNLOCK-THE-LIFE_Profile-300x450.jpg" },
];

/**
 * How many posters each surface shows. Every count is a prefix length into
 * PROGRAM_POSTERS — these are the lengths the live site cuts that list at, read
 * off its markup, not numbers we chose.
 */
export const POSTER_COUNT = {
  /** កម្មវិធីពិសេសរបស់ AMS INFOTAINMENT — the grid in the dark home band. */
  special: 8,
  /** ភាពយន្តពេញនិយម — the ranked list beside it. */
  popular: 9,
  /** សម្រាប់លោកអ្នក — the landing pages' band. */
  landingBand: 15,
  /** ជ្រើសរើសកម្មវិធីដែលលោកអ្នកចូលចិត្ត — home / program / episode carousel. */
  carousel: 18,
  /** The strip below an article — the only slot that shows every program. */
  articleStrip: 20,
} as const;

/** The first `limit` posters — plus, on the "all programs" surfaces (carousel
 *  length and up), any published program the curated list doesn't know yet.
 *
 *  That's the "new programs default to the carousel" rule: a program created
 *  in the dashboard appears in the poster carousel and the article strip
 *  automatically (once it has PORTRAIT featured-image art — the same 2:3 the
 *  Create form asks for), while the two ranked lists (special 8 / popular 9)
 *  and the nav pills / icon strip stay curated here in code. */
export async function getFeaturedPrograms(limit: number = PROGRAM_POSTERS.length): Promise<FeaturedProgram[]> {
  const base = PROGRAM_POSTERS.slice(0, limit);
  if (limit < POSTER_COUNT.carousel) return base;

  const { getProgramRegistry } = await import("./programs");
  const curated = new Set(PROGRAM_POSTERS.map(p => p.slug));
  const extras = (await getProgramRegistry())
    .filter(r => !curated.has(r.slug) && r.poster)
    .map(r => ({ slug: r.slug, title: r.title, year: r.year, image: r.poster }));
  return [...base, ...extras];
}
