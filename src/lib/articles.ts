// Article data, backed by the AMS Infotainment WordPress REST API.
//
// Components import the getters below (getArticle / getCategoryPage /
// getArticleExtras); the getters call the API and map raw WP shapes into the
// domain types here. See src/lib/api/ for the client + mappers.

import { notFound } from "next/navigation";
import { ApiError, apiFetch, safeTag } from "./api/client";
import { fetchArticleList } from "./api/article-list";
import { categoryHref, getCategoryDepths, getCategoryHrefs, getCategoryTerms } from "./categories";
import { mapArticle, mapArticleRef } from "./api/mappers";
import type { WpArticleDetail } from "./api/wp-types";
import { getFeaturedPrograms, type FeaturedProgram } from "./navigation";

export interface Author {
  name: string;
  avatar: string;
  bio: string;
}

/** A category as shown on an article, with a link to its listing. `href` is null
 *  when the category can't be resolved to a term — the label then renders as
 *  plain text rather than a link that goes nowhere. */
export interface CategoryLink {
  id: number;
  name: string;
  href: string | null;
}

export interface Article {
  /** The WordPress post id — what a comment POST targets. */
  id: number;
  slug: string;
  title: string;
  /** ទំព័រដើម › section › topic › title. The last crumb is the article itself and
   *  carries a null href — as does any category whose term didn't resolve. */
  breadcrumb: { label: string; href: string | null }[];
  categories: CategoryLink[];
  /** Display date, "08/07/2026". */
  date: string;
  /** ISO-8601 with an explicit +07:00 offset, for `article:published_time` and
   *  JSON-LD. Empty when WordPress has no date. */
  publishedAt: string;
  modifiedAt: string;
  /** Meta description — Yoast's if the editor set one, else the excerpt. */
  description: string;
  commentCount: number;
  featured: { src: string; badge?: string };
  /** Rendered article body — Gutenberg HTML from WordPress `post_content`. */
  bodyHtml: string;
  author: Author;
}

export interface ArticleRef {
  slug: string;
  title: string;
  image: string;
  date?: string;
  /** The article's categories, each linking to its listing when the term
   *  resolves — shown in the meta line of list cards. */
  categories?: CategoryLink[];
  /** Comment count — renders "Leave a comment" (0) or "N comments" in the meta. */
  commentCount?: number;
  /** Short excerpt — shown by the "featured" card variant (FeaturedArticleCard). */
  description?: string;
}

export interface NamedList {
  heading: string;
  items: ArticleRef[];
  /** The listing this widget's "see all" points at. Absent on the widgets that
   *  have no destination (the anonymous windows into the recent feed). */
  href?: string;
}

export interface PopularItem {
  slug: string;
  title: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fetch a page of the general feed and map to ArticleRef. Returns [] on error
 *  so a failing sub-section degrades gracefully instead of taking down the page. */
async function recentRefs(pageSize: number, tags: string[]): Promise<ArticleRef[]> {
  try {
    const [env, hrefs] = await Promise.all([
      fetchArticleList({ pageSize }, { revalidate: 3600, tags }),
      getCategoryHrefs(),
    ]);
    return (env.data ?? []).map((a) => mapArticleRef(a, hrefs));
  } catch {
    return [];
  }
}

/** A category's most recent articles as ArticleRefs. Returns [] on error so a
 *  news column degrades to empty instead of taking the page down. */
export async function categoryRefs(category: string, pageSize: number): Promise<ArticleRef[]> {
  try {
    const [env, hrefs] = await Promise.all([
      fetchArticleList(
        { pageSize, categorySlug: category },
        { revalidate: 3600, tags: ["articles", `category:${category}`] },
      ),
      getCategoryHrefs(),
    ]);
    return (env.data ?? []).map((a) => mapArticleRef(a, hrefs));
  } catch {
    return [];
  }
}

/** A category's most recent articles, addressed by term ID rather than slug.
 *
 *  Two differences from categoryRefs that decide which one a block wants:
 *   - `category_id` takes a COMMA-SEPARATED list and returns the UNION of those
 *     terms; the slug endpoint takes exactly one.
 *   - it matches DIRECT assignments only, where the slug endpoint aggregates the
 *     term's descendants. Identical for a leaf term, very different for a parent
 *     (entertainment-news is 7,660 by id and 7,737 by slug).
 *
 *  Returns [] on error, like categoryRefs — one dead block, not a dead page. */
export async function categoryRefsByIds(ids: string, pageSize: number): Promise<ArticleRef[]> {
  try {
    const [env, hrefs] = await Promise.all([
      fetchArticleList(
        { pageSize, categoryIds: ids },
        { revalidate: 3600, tags: ["articles", `category-ids:${ids}`] },
      ),
      getCategoryHrefs(),
    ]);
    return (env.data ?? []).map((a) => mapArticleRef(a, hrefs));
  } catch {
    return [];
  }
}

/** Slugs of the most recent articles — used by generateStaticParams to prebuild
 *  the hot article pages. */
export async function getRecentArticleSlugs(limit = 12): Promise<string[]> {
  const refs = await recentRefs(limit, ["articles"]);
  return refs.map((r) => r.slug);
}

// ─── Article detail ──────────────────────────────────────────────────────────

/** Full article by slug (get-article-by-slug). 404s if the slug isn't found.
 *
 *  ONLY a 404 becomes a 404. This used to `.catch(() => null)` everything, which
 *  fed the notFound() below — so a 500, a timeout or a dead upstream turned a
 *  real article into a 404 that ISR then served for an hour, across the biggest
 *  URL surface on the site (10k+ articles). The endpoint answers a clean 404 for
 *  an unknown slug (verified: status 404, with this host's replaced HTML body),
 *  so the status code is the honest signal and everything else rethrows.
 *  See the error-handling note in api/client.ts. */
export async function getArticle(slug: string): Promise<Article> {
  const [raw, categoryHrefs, depths] = await Promise.all([
    apiFetch<WpArticleDetail>(`/wp/v2/web/get-article-by-slug?slug=${encodeURIComponent(slug)}`, {
      revalidate: 3600,
      // safeTag: a percent-encoded Khmer slug can exceed the 256-char tag
      // limit, and an over-long tag is silently dropped at build time.
      tags: ["article", safeTag(`article:${slug}`)],
    }).catch((e: unknown) => {
      if (e instanceof ApiError && e.statusCode === 404) return null;
      throw e;
    }),
    getCategoryHrefs(),
    getCategoryDepths(),
  ]);

  if (!raw?.id) notFound();
  return mapArticle(raw, slug, categoryHrefs, depths);
}

export interface ArticleExtras {
  // sidebar (right column)
  popular: PopularItem[];
  sidebarLists: NamedList[];
  emptyWidget: string;
  // below the article body
  recentReports: NamedList;
  entertainment: NamedList;
  programs: FeaturedProgram[];
  videos: NamedList;
  prevPost: { slug: string; title: string; meta: string };
  nextPost: { slug: string; title: string; meta: string };
  otherNews: NamedList;
}

const metaLine = (r?: ArticleRef) => (r ? [r.categories?.map((c) => c.name).join(", "), r.date].filter(Boolean).join(" · ") : "");

/**
 * The three category widgets in the article sidebar.
 *
 * Their HEADINGS are editorial and are not the term names — រសជាតិ ("flavour")
 * heads the TRAVEL feed, and ភាពយន្ត heads `movie-and-music`. That mismatch is
 * exactly why these used to be sliced out of the generic recent feed and nobody
 * noticed: the headings gave no hint of which term they belonged to. Each one is
 * scoped to its own category on the live site, so each is fetched from it here.
 */
const SIDEBAR_WIDGETS = [
  { heading: "រសជាតិ", slug: "life-style-travel-news", size: 3 },
  { heading: "ស្នេហានិងទំនាក់ទំនង", slug: "life-style-love-and-relation-news", size: 5 },
  { heading: "ភាពយន្ត", slug: "entertainment-movie-and-music-news", size: 5 },
] as const;

/** Sidebar widgets + below-article sections.
 *
 *  Every block that carries a category HEADING is fetched from that category —
 *  the three sidebar widgets and the two RelatedColumns blocks. Only the blocks
 *  with no category in their name (ប្រធានបទពេញនិយម, ព័ត៌មានសង្ខេប,
 *  ព័ត៌មានផ្សេងៗទៀត and the prev/next pager) are windows into the general feed,
 *  and they take DISJOINT windows of it so no article shows up twice on the page.
 *
 *  `get-article-by-category-slug` aggregates over a term's descendants, so
 *  "reports" and "entertainment-news" cover their whole subtree. It takes a term
 *  SLUG, not a URL path — the entertainment listing lives at
 *  /category/entertainment-news/news but its term is `entertainment-news`. */
export async function getArticleExtras(): Promise<ArticleExtras> {
  const [refs, programs, reports, entertainment, widgets, hrefs] = await Promise.all([
    recentRefs(24, ["articles"]),
    getFeaturedPrograms(),
    categoryRefs("reports", 8),
    categoryRefs("entertainment-news", 9),
    Promise.all(SIDEBAR_WIDGETS.map((w) => categoryRefs(w.slug, w.size))),
    getCategoryTerms(),
  ]);

  const at = (start: number, n: number) => refs.slice(start, start + n);
  const bySlug = new Map(hrefs.map((t) => [t.slug, t]));
  const listing = (slug: string) => {
    const term = bySlug.get(slug);
    return term ? categoryHref(term.path) : categoryHref(slug);
  };

  return {
    popular: at(0, 5).map((r) => ({ slug: r.slug, title: r.title })),
    sidebarLists: SIDEBAR_WIDGETS.map((w, i) => ({
      heading: w.heading,
      items: widgets[i],
      href: listing(w.slug),
    })),
    emptyWidget: "ដំណើរកម្សាន្ត",
    recentReports: { heading: "របាយការណ៍ថ្មីៗ", items: reports },
    // RelatedColumns renders the first item as a large featured card, the rest as rows.
    entertainment: { heading: "អត្ថបទកម្សាន្ត", items: entertainment },
    programs,
    videos: { heading: "ព័ត៌មានសង្ខេប", items: at(5, 8) },
    otherNews: { heading: "ព័ត៌មានផ្សេងៗទៀត", items: at(13, 9) },
    prevPost: { slug: refs[22]?.slug ?? "#", title: refs[22]?.title ?? "", meta: metaLine(refs[22]) },
    nextPost: { slug: refs[23]?.slug ?? "#", title: refs[23]?.title ?? "", meta: metaLine(refs[23]) },
  };
}

// ─── Category listing page (/category/[category]) ────────────────────────────

/** Maps a URL slug to its Khmer display name. A last-resort fallback — the real
 *  name comes from the term (src/lib/categories.ts) or the API response. */
const CATEGORY_NAMES: Record<string, string> = {
  "all-news": "ព្រឹត្តិការណ៍",
  "entertainment-news": "ព័ត៌មានកម្សាន្ត",
  "entertainment-strange-news": "ព័ត៌មានកម្សាន្តប្លែកៗ",
  "life-style-news": "ព័ត៌មានរសនិយម",
  "life-style-life-tips-news": "បំណិនជីវិត",
};

export function categoryName(slug: string): string {
  return CATEGORY_NAMES[slug] ?? decodeURIComponent(slug);
}

export interface CategoryPage {
  slug: string;
  name: string;
  /** First item renders as a large featured card, the rest as horizontal rows. */
  articles: ArticleRef[];
  /** Right-column widgets (thumbnail-row lists). */
  sidebar: NamedList[];
  page: number;
  totalPages: number;
}

/** A category listing page's worth of articles.
 *
 *  Exported because the 404 gate in category/[...path]/layout.tsx divides the
 *  term's article count by it to decide which `/page/N` URLs can exist. If the
 *  two disagreed, the gate would 404 real pages. */
export const CATEGORY_PAGE_SIZE = 10;

/** Articles for a category (get-article-by-category-slug).
 *
 *  `page_size` is the whole page's worth: the route renders the first item as the
 *  featured card and the rest as rows, so 10 shows 1 + 9. Change it here rather
 *  than slicing in the route — the API derives `total_page` from this, so a slice
 *  would drop the trailing article off every page and out of the pagination.
 *
 *  THROWS when the LISTING fails — it is the page's whole subject (case 2 in the
 *  error-handling note in api/client.ts). It used to `.catch(() => null)`, which
 *  wrote "មិនទាន់មានអត្ថបទក្នុងប្រភេទនេះទេ" into a static page and served it for
 *  an hour, indistinguishable from the two report categories that really are
 *  empty. Those still render that message, because they answer 200 with zero
 *  rows — the distinction the throw restores. The three SIDEBAR widgets keep
 *  swallowing: they are decoration on someone else's page. */
export async function getCategoryPage(category: string, page = 1): Promise<CategoryPage> {
  const [env, hrefs, terms, own, reports, popular] = await Promise.all([
    fetchArticleList(
      { pageSize: CATEGORY_PAGE_SIZE, page, categorySlug: category },
      { revalidate: 3600, tags: ["articles", `category:${category}`] },
    ),
    getCategoryHrefs(),
    getCategoryTerms(),
    // Widget 1 is THIS category's latest — the one thing on the page that is
    // scoped to the term you're looking at. It used to render the same global
    // recents on every listing.
    categoryRefs(category, 3),
    // Widget 2 names បទយកការណ៍, so it comes from the reports tree. It used to be
    // fed from the news feed, which is how it ended up leaking news articles.
    categoryRefs("reports", 3),
    // Widget 3 ("most read") has no view-count field anywhere in REST, so there
    // is nothing to order by: it stays the most recent articles site-wide until
    // WordPress exposes one. Honest recents beat a third slice pretending to be
    // a ranking.
    recentRefs(3, ["articles"]),
  ]);

  const raw = env.data ?? [];
  // Prefer the real category name from the response; fall back to the map.
  const matched = raw.flatMap((a) => a.categories).find((c) => c.slug === category);
  const term = terms.find((t) => t.slug === category);

  return {
    slug: category,
    name: matched?.name ?? categoryName(category),
    articles: raw.map((a) => mapArticleRef(a, hrefs)),
    sidebar: [
      { heading: "ប្រធានបទពេញនិយម", items: own, href: term ? categoryHref(term.path) : categoryHref(category) },
      { heading: "របាយការណ៍", items: reports, href: categoryHref("reports") },
      { heading: "អត្ថបទពេញនិយម", items: popular, href: categoryHref("all-news") },
    ],
    page: env.page ?? page,
    totalPages: env.total_page ?? 1,
  };
}
