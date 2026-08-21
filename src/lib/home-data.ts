// Data for the AMS Infotainment homepage.
//
// This is a faithful port of the `renderVals()` logic from the original design
// mock. Everything here is deterministic (no randomness), so it can be computed
// once and rendered on the server.
//
// The article grids (daily/latest/lifestyle), the episode rails and the featured
// program banner are all fetched live now. See getHomeFeed below.

import { fetchArticleList, type ArticleListQuery } from "./api/article-list";
import { mapHomeCard } from "./api/mappers";
import { getCategoryHrefs, getCategoryTerms, NAV_SECTIONS } from "./categories";
import { fetchEpisodeCards } from "./episodes";
import { getFeaturedProgram } from "./featured-program";
import { categoryRefs, categoryRefsByIds, popularArticleRefs, type CategoryLink, type PopularItem } from "./articles";

// MasVideos tv_show IDs (episodes link to a show via `_tv_show_id`), each paired
// with our program slug so its cards can link to /program/<slug>/<episode>.
const TV_SHOW_HEALTH = { slug: "1-minute-for-health", id: 14570 }; // ១នាទីដើម្បីសុខភាព
const TV_SHOW_OBSOK = { slug: "obsok", id: 14512 }; // អផ្សុក

/** ព្រឹត្តិការណ៍ [all-news], the news root — what the ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ tabs are
 *  scoped to.
 *
 *  It does NOT aggregate the tree beneath it: `category_id` (web/*) and
 *  `categories` (core) both match DIRECT assignments only, so this id reaches
 *  only articles directly tagged with it, not the whole subtree. Every RECENT
 *  article carries the root tag, which is all a three-day window ever sees —
 *  but that is why the id can't be traded for `slug=all-news` (which does
 *  aggregate the full subtree) without changing what the tabs return. */
const ALL_NEWS_ID = 515;

/** Cards per page of ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ: the lead card plus its 2×2 cluster. */
const NEWS_PAGE_SIZE = 5;

/** Pages served per upstream request.
 *
 *  Every call to this WordPress costs ~3.7s no matter what it returns — 25
 *  articles measured 0.1s slower than 5, and core's `wp/v2/posts` asked for three
 *  fields is just as slow, so it is site-wide overhead rather than a slow query.
 *  Fetching a page at a time therefore made EVERY pager click a fresh ~4s wait,
 *  because each page is a distinct URL nothing has warmed.
 *
 *  So one request fetches five pages' worth and the page is sliced out of it.
 *  Pages 2-5 of a block reuse that same cached fetch (~0.4s); only crossing into
 *  a new block pays the round trip again. Five is chosen to cover realistic
 *  paging depth — a larger block would spend the same 3.7s to cover pages almost
 *  nobody reaches, and discard more of what it fetched.
 *
 *  (A8: these feeds now go through fetchArticleList, so a cold block is ~0.3s on
 *  the fast path and ~3.7s only on REST fallback. The block is kept either way —
 *  one ISR cache entry per five pages is the point, not just the round trip.) */
const NEWS_BLOCK_PAGES = 5;
const NEWS_BLOCK_SIZE = NEWS_PAGE_SIZE * NEWS_BLOCK_PAGES;



/**
 * A homepage feed card. One shape for every home grid — the optional fields
 * cover the small differences between sections:
 *  - `tags` / `date`  → daily, latest, lifestyle cards
 *  - `ep`             → health-episode cards ("S1:E12")
 * (Replaces the old ArticleCard / HealthCard / SimpleCard triple.)
 */
export interface HomeCard {
  /** Article slug — the card links to /article/[slug]. */
  slug: string;
  /** Explicit href, used by episode cards (/program/<program>/<episode>).
   *  When set it wins over `slug`, which otherwise implies /article/<slug>. */
  href?: string;
  src: string;
  title: string;
  /** The article's categories (first three), each linking to its listing. */
  tags?: CategoryLink[];
  date?: string;
  ep?: string;
}


/** Fetch + map a page of home cards. Returns [] on error, and the section that
 *  asked for it is then DROPPED by its component rather than filled — see the
 *  note on getHomeFeed. */
async function fetchHomeCards(q: ArticleListQuery): Promise<HomeCard[]> {
  try {
    const [env, hrefs] = await Promise.all([
      // 1h floor (ISR-writes budget): freshness is pushed by the publish
      // webhook's "home"/"articles" busts, not this polling window.
      fetchArticleList(q, { revalidate: 3600, tags: ["articles", "home"] }),
      getCategoryHrefs(),
    ]);
    return (env.data ?? []).map((a) => mapHomeCard(a, hrefs));
  } catch {
    return [];
  }
}

/** One page of a ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ pager: the five cards, which page they are,
 *  and how many pages the feed has. `totalPages` is 0 for an empty feed; a FAILED
 *  read no longer lands here at all — fetchCardBlock throws (see below). */
export interface CardPage {
  cards: HomeCard[];
  page: number;
  totalPages: number;
}

/** How the caller addresses its feed: which slice of the article feed it walks,
 *  plus its own caching. The homepage pages the news root by category id; a
 *  landing section pages its own term by slug (which aggregates descendants —
 *  see fetchArticleList). Page/size are chosen per BLOCK by fetchCardPage. */
interface PagedFeed {
  filter: Pick<ArticleListQuery, "categorySlug" | "categoryIds">;
  revalidate: number;
  tags: string[];
}

/** One BLOCK of a feed, plus the count the pager needs.
 *
 *  `totalPages` is derived from `total` (the article count) and NOT from the
 *  envelope's `total_page`: that field counts pages at the size we ASKED for, so
 *  with a 25-article block it answers 33 where the pager numbers 161 pages of
 *  five. `total` comes back as a string on these endpoints, hence Number().
 *
 *  THROWS. This block is the ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ pager's content, and on the
 *  HOMEPAGE that pager is the page's subject — so a failed read must not be
 *  published as a homepage without it. Callers that treat the strip as a tail
 *  block (the program and episode pages, the landing sections) catch it
 *  themselves. See the error-handling note in api/client.ts. */
async function fetchCardBlock(blockNo: number, feed: PagedFeed): Promise<{ cards: HomeCard[]; totalPages: number }> {
  const [env, hrefs] = await Promise.all([
    fetchArticleList(
      { ...feed.filter, page: blockNo, pageSize: NEWS_BLOCK_SIZE },
      { revalidate: feed.revalidate, tags: feed.tags },
    ),
    getCategoryHrefs(),
  ]);
  return {
    cards: (env.data ?? []).map((a) => mapHomeCard(a, hrefs)),
    totalPages: Math.ceil((Number(env.total) || 0) / NEWS_PAGE_SIZE),
  };
}

/** One page of a paged feed, newest first — shared by every ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ
 *  pager on the site (the homepage's and the landing sections').
 *
 *  Fetches the BLOCK the page falls in (see NEWS_BLOCK_PAGES) and slices the five
 *  cards out of it, so consecutive pages share one cached upstream request.
 *
 *  Out of range falls back to page 1, which covers every way a page can come back
 *  empty: a block past the end (the REST endpoints answer 404, the fast path an
 *  empty list — both land here as zero cards), and a page inside the LAST block
 *  that still sits past the final article (page 162 slices at offset 5 of a
 *  2-article block). Neither can be clamped before asking — the article count
 *  only arrives with a successful response — so it costs a second request, and
 *  only on a URL somebody hand-edited. */
export async function fetchCardPage(page: number, feed: PagedFeed): Promise<CardPage> {
  const blockOf = (p: number) => Math.floor((p - 1) / NEWS_BLOCK_PAGES) + 1;
  const pageOf = (block: HomeCard[], p: number) => {
    const offset = ((p - 1) % NEWS_BLOCK_PAGES) * NEWS_PAGE_SIZE;
    return block.slice(offset, offset + NEWS_PAGE_SIZE);
  };

  const asked = await fetchCardBlock(blockOf(page), feed);
  const cards = pageOf(asked.cards, page);
  if (cards.length > 0 || page === 1) return { cards, page, totalPages: asked.totalPages };

  const first = await fetchCardBlock(1, feed);
  return { cards: pageOf(first.cards, 1), page: 1, totalPages: first.totalPages };
}

/** A feed that could not be read, for the callers that treat the strip as a tail
 *  block. `totalPages: 0` suppresses the pager, so no links are minted for pages
 *  we cannot confirm exist. */
const EMPTY_PAGE: CardPage = { cards: [], page: 1, totalPages: 0 };

/** The HOMEPAGE's pager: the news root, by category id. */
const fetchNewsPage = (page: number) =>
  fetchCardPage(page, {
    filter: { categoryIds: String(ALL_NEWS_ID) },
    revalidate: 3600,
    tags: ["articles", "home"],
  });

/** មាតិការសនិយម — one tab per NAV_SECTIONS term (economic/finance/real-estate/
 *  business/pr/start-up-innovation), four articles each, switching in place.
 *  Reuses NAV_SECTIONS (categories.ts) rather than re-pinning the same six
 *  slugs here — see its header comment for why they can't be derived. */
async function getMatikaTabs() {
  const [terms, ...tabItems] = await Promise.all([
    getCategoryTerms(),
    ...NAV_SECTIONS.map((s) => categoryRefs(s.news, 4)),
  ]);
  const bySlug = new Map(terms.map((t) => [t.slug, t]));
  return {
    heading: "អត្ថបទថ្មីៗដែលលោកអ្នកគួរយល់ដឹង",
    tabs: NAV_SECTIONS.map((s, i) => ({
      label: bySlug.get(s.news)?.name ?? s.news,
      href: s.href,
      items: tabItems[i],
    })),
  };
}

/**
 * All homepage feed content in one call.
 *  - daily comes from the general article feed (`get-articles`)
 *  - latest / lifestyle come from their categories (`get-article-by-category-slug`)
 *  - health / obsok come from their TV shows' episodes (`tv-show-episodes`)
 *  - featured is the video banner, set in WP admin (`featured-program`)
 *
 * NOTHING HERE IS FAKED. Every grid used to fall back to curated mock cards —
 * Unsplash stock photos under invented Khmer headlines — so a page that could not
 * reach WordPress published fabricated articles a reader could not tell from real
 * ones. Each grid now returns EMPTY on failure and its section drops out of the
 * page entirely (the components return null), which is what `featured` has always
 * done. Fewer real blocks, never invented ones.
 *
 * `dailyIsSubject` — the HOMEPAGE passes true, because ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ is
 * the reason that page exists; a failed read throws and ISR keeps serving the last
 * good homepage instead of publishing one with its main feed missing. The program
 * and episode pages leave it false: there the same strip is a tail block, and
 * losing it must not take down a page about something else.
 */
export async function getHomeFeed(newsPage = 1, dailyIsSubject = false) {
  const [
    daily, reports, life, health, healthFromStart, obsok, featured,
    latestNews, recentArticles, innovation, economic, realestate, business, finance, matika, entertainment,
  ] = await Promise.all([
    // ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ — one page of the news root, newest first. This was
    // three day tabs until the date filter was dropped for a pager; the day
    // windows (and wp-core's fetchDayCards) now serve only the landing pages.
    dailyIsSubject ? fetchNewsPage(newsPage) : fetchNewsPage(newsPage).catch(() => EMPTY_PAGE),
    // របាយការណ៍ថ្មីៗ — queried by category ID, not slug: `categoryIds` takes a
    // comma-separated list and returns the UNION of those terms, pinning the
    // exact set rather than letting `slug=reports` aggregate the whole reports subtree.
    // 971 = reports root (បទយកការណ៍); 989/991 = its health-and-beauty & life-tips reports.
    fetchHomeCards({ pageSize: 4, categoryIds: "991,971,989" }),
    fetchHomeCards({ pageSize: 6, categorySlug: "life-style-news" }),
    // Health twice, in both directions — the HOMEPAGE shelf reads as a series to
    // start from E1, while the same section on the program/episode pages stays a
    // what's-new strip. Two calls, one round trip: both go through the same
    // cached fetchShowEpisodes, exactly as fetchSeasonCards does.
    fetchEpisodeCards(TV_SHOW_HEALTH.slug, TV_SHOW_HEALTH.id, 12),
    fetchEpisodeCards(TV_SHOW_HEALTH.slug, TV_SHOW_HEALTH.id, 12, "oldest"),
    fetchEpisodeCards(TV_SHOW_OBSOK.slug, TV_SHOW_OBSOK.id, 12),
    getFeaturedProgram(),
    // របាយការណ៍ថ្មីៗ — five articles assigned directly to category 565.
    categoryRefsByIds("565", 5),
    // ព័ត៌មានពេញនិយម — WPP's nine most-viewed posts over the last 30 days.
    popularArticleRefs(9),
    // អាជីវកម្មថ្មី និងនវានុវត្ត — the news-startup-and-innovation section (see
    // NAV_SECTIONS in categories.ts), lead card + 3 rows.
    categoryRefs("news-startup-and-innovation", 4),
    // សេដ្ឋកិច្ច — the news-economic section's own feed, as a ranked list.
    categoryRefs("news-economic", 7),
    // អចលនទ្រព្យ / ជំនួញ — three-up card rows, the other two NAV_SECTIONS terms.
    categoryRefs("news-realestate", 3),
    categoryRefs("news-business", 3),
    // ហិរញ្ញវត្ថុ — beside them, a thumbnail list.
    categoryRefs("news-finance", 5),
    // មាតិការសនិយម — all six NAV_SECTIONS terms as switching tabs.
    getMatikaTabs(),
    // អត្ថបទកម្សាន្ត — Economy's taxonomy has no entertainment-news term (that's
    // Infotainment's), so this runs on top-news, the closest real analog.
    categoryRefs("top-news", 3),
  ]);

  return {
    // One page of ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ. `totalPages` 0 suppresses the pager,
    // which is what an empty or unavailable feed should do — handing out links
    // to pages that don't exist was the one thing the old mock path got right.
    daily,
    latest: reports,
    lifestyle: life.slice(0, 6),
    // Newest-first, for the HealthSection on the program and episode pages.
    healthGrid: health,
    // Oldest-first (E1 …), for the homepage's HealthSection only.
    healthFromStart,
    obsokGrid: obsok,
    featured,
    latestNews,
    recentArticles,
    innovation,
    economic: economic.map((r): PopularItem => ({ slug: r.slug, title: r.title })),
    realestate,
    business,
    finance,
    matika,
    entertainment,
  };
}

export interface FooterLink {
  label: string;
  href: string;
  /** Another AMS property, so it opens off-site. */
  external?: boolean;
}

/**
 * The footer's three link columns.
 *
 * Every one of these `href`s used to be "#" — 22 dead links on every page of the
 * site, the only ones anywhere in the app. Column 1 points at the topic LANDING
 * pages (the same destination the header's topic links use, see landingHref);
 * column 2 leaves for the other AMS properties; column 3 is the four WordPress
 * pages that /[...path] now serves.
 *
 * AMS Radio has no site yet — it is "#" on the live footer too, so it is dropped
 * here rather than shipped as our own dead link.
 */
export const footerCols: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "AMS ECONOMY",
    links: [
      { label: "តារាល្បីៗ", href: "/celebrity" },
      { label: "ភាពយន្តនិងតន្ត្រី", href: "/movie-and-music" },
      { label: "ព័ត៌មានកម្សាន្តប្លែកៗ", href: "/strange" },
      { label: "អាហារនិងដើរលេង", href: "/life-style/travel" },
      { label: "សុខភាពនិងសម្រស់", href: "/life-style/health-and-beauty" },
      { label: "បំណិនជីវិត", href: "/life-style/life-tips" },
    ],
  },
  {
    heading: "បណ្តាញព័ត៌មានផ្សេងៗទៀតពី AMS GROUP",
    links: [
      { label: "AMS Education", href: "https://education.ams.com.kh", external: true },
      { label: "AMS Economy", href: "/" },
      { label: "AMS Infotainment", href: "https://infotainment.ams.com.kh", external: true },
      { label: "AMS Khmer Civilization", href: "https://ams.com.kh/khmercivilization", external: true },
      { label: "AMS Central", href: "https://ams.com.kh/central", external: true },
      { label: "AMS Sport", href: "https://ams.com.kh/sports", external: true },
      { label: "AMS TV11", href: "https://ams.com.kh/tv11", external: true },
    ],
  },
  {
    heading: "ស្វែងយល់បន្ថែម",
    links: [
      { label: "ផ្សព្វផ្សាយពាណិជ្ជកម្ម", href: "/advertising" },
      { label: "ទំនាក់ទំនង", href: "/contact" },
      { label: "សំណួរទូទៅ", href: "/question" },
      { label: "ជ្រើសរើសបុគ្គលិក", href: "/jobs" },
    ],
  },
];

/** The legal links in the black bar at the very bottom. */
export const footerLegal: FooterLink[] = [
  { label: "គោលការណ៍ភាពឯកជន", href: "/privacy-policy" },
  { label: "ដំណឹងតាមច្បាប់", href: "/terms-conditions" },
  { label: "COOKIES (ខូខី)", href: "/cookies" },
];

/** The 4th footer column is a newsletter CTA, not a link list.
 *
 *  It stays a button with no destination on purpose: live's is a `<button>` with
 *  no handler and no vendor script behind it, so there is nothing to point at.
 *  See AUDIT.md — "Newsletter: nothing to clone." */
export const newsletter = {
  heading: "ទស្សនាជាមួយ AMS គ្រប់ពេលវេលា គ្រប់ទីកន្លែង",
  buttonLabel: "ចុចទទួលបានព័ត៌មានថ្មីបំផុតឥឡូវនេះ",
};
