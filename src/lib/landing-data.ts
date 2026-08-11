// Data for the section and topic LANDING pages (/life-style, /celebrity).
//
// Not to be confused with the category LISTING pages (/category/life-style/news),
// which are a different layout backed by getCategoryPage(). See landingHref() in
// src/lib/categories.ts for why both exist.

import { apiFetch } from "./api/client";
import { mapProgram } from "./api/mappers";
import { categoryRefs, categoryRefsByIds, type ArticleRef, type PopularItem } from "./articles";
import { getTeam, type TeamMember } from "./authors";
import { categoryHref, getCategoryTerms, landingHref, type Landing } from "./categories";
import { fetchEpisodeCards } from "./episodes";
import { type FeaturedProgram as TrailerProgram } from "./featured-program";
import { getFeaturedPrograms, POSTER_COUNT, type FeaturedProgram } from "./navigation";
import { programBySlug, programHref } from "./programs";
import { fetchCardPage, type CardPage } from "./home-data";

/** A ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ widget with nothing in it — a topic page (which carries
 *  no such widget) or a section page whose feed could not be read. */
const EMPTY_CARD_PAGE: CardPage = { cards: [], page: 1, totalPages: 0 };
import type { HomeCard } from "./home-data";
import type { WpObjectEnvelope, WpProgram } from "./api/wp-types";

/** A block of article cards with a heading and a "see all" into its listing. */
export interface Block {
  heading: string;
  href: string;
  items: ArticleRef[];
}

/** A block rendered as a numbered, text-only list. */
export interface RankedBlock {
  heading: string;
  href: string;
  items: PopularItem[];
}

/**
 * The tail every landing page shares.
 *
 * The two section pages are identical below their own scoped head, and so are
 * the nine topic pages — each block is hardwired to the category its heading
 * names, not to the page's own term. That is why the entertainment section page
 * still carries the life-style topics: on the live site it genuinely does.
 *
 * The headings are editorial, written by hand in WordPress, and are NOT the term
 * names — គន្លឹះថែរក្សាសម្ផស្ស heads the `health-and-beauty` feed (whose term is
 * named សុខភាពនិងសម្រស់), and ភាពយន្ត heads `movie-and-music` (ភាពយន្តនិងតន្ត្រី).
 * They can't be read off the API, so they live here.
 *
 * `slug` is the term SLUG, not its URL path — `get-article-by-category-slug`
 * takes the slug and aggregates over the term's descendants.
 *
 * `ids`, when present, fetches by term ID instead (a comma-separated list, whose
 * UNION is returned — see categoryRefsByIds). `slug` still supplies the block's
 * "see all" link either way, so the two can disagree: that is exactly what live
 * does on បំណិនជីវិត, which links to life-tips but is filled with strange news.
 */
interface TailBlock {
  heading: string;
  /** Drives the "see all" href, and the fetch when `ids` is absent. */
  slug: string;
  size: number;
  /** Comma-separated term IDs. When set, these are fetched instead of `slug`. */
  ids?: string;
}

const TAIL = {
  /** Big cards, two to a row. A section page runs a 2x2 of them; a topic page,
   *  whose right column is shorter, shows only the first row. Fetched once at the
   *  longer size and sliced. */
  // MATCHES LIVE, mislabelled the same way as lifeTips below: the heading and the
  // "see all" say all-news, but live fills this from life-tips (956) — verified as
  // exactly the newest four of that feed. `slug` keeps the link on all-news, as
  // live's does. Delete `ids` to go back to a genuine all-news mix.
  interest: { heading: "ចំណាប់អារម្មណ៍របស់ប្រិយមិត្ត", slug: "all-news", ids: "956", size: 4 },
  // MATCHES LIVE, and live is mislabelled: the heading and the "see all" say
  // បំណិនជីវិត / life-tips, but the block is filled from entertainment-strange-news
  // (963) — the same feed the ព័ត៌មានប្លែកៗ block below it already runs, so live
  // shows strange news twice and life-tips nowhere. Kept deliberately, to match
  // the live page first; `slug` still points the "see all" at life-tips, as live's
  // does. Switch back by deleting `ids`.
  lifeTips: { heading: "បំណិនជីវិត", slug: "life-style-life-tips-news", ids: "963", size: 4 },
  skincare: { heading: "គន្លឹះថែរក្សាសម្ផស្ស", slug: "life-style-health-and-beauty-news", size: 7 },
  love: { heading: "ស្នេហានិងទំនាក់ទំនង", slug: "life-style-love-and-relation-news", size: 3 },
  travel: { heading: "ទេសចរណ៍", slug: "life-style-travel-news", size: 3 },
  movies: { heading: "ភាពយន្ត", slug: "entertainment-movie-and-music-news", size: 7 },
  strange: { heading: "ព័ត៌មានប្លែកៗ", slug: "entertainment-strange-news", size: 5 },
  entertainment: { heading: "អត្ថបទកម្សាន្ត", slug: "entertainment-news", size: 3 },
  /** Both pages carry this block, at different lengths: a topic page runs all 7
   *  in its head, beside its own feed; a section page shows the first 5, further
   *  down in the tail. Fetched once at the longer size and sliced. */
  // Also life-tips on live (the newest five, which is what a section page shows
  // of this block) — so live runs the same 956 feed in this block AND in
  // `interest` above, four of the five articles being the same ones.
  popular: { heading: "ប្រធានបទពេញនិយម", slug: "all-news", ids: "956", size: 7 },
  /** Section pages only.
   *
   *  NOT matched to live, and cannot be with this API. Live fills it from
   *  life-tips (956) too, but ordered by POPULARITY, not date — its six articles
   *  are from 2023-2025 and none are recent. `get-articles` registers only
   *  page_no / page_size / category_id / date_filter (see docs/ams3e-api-functions),
   *  so there is no way to ask for it. Matching would need an `orderby` on the
   *  plugin side; until then this stays a recent all-news mix. */
  topNews: { heading: "ព័ត៌មានពេញនិយម", slug: "all-news", size: 6 },
  reports: { heading: "របាយការណ៍ថ្មីៗ", slug: "reports", size: 10 },
} satisfies Record<string, TailBlock>;

/** A tail block's articles, by ID when the entry names them and by slug otherwise. */
function tailRefs(entry: TailBlock): Promise<ArticleRef[]> {
  return entry.ids ? categoryRefsByIds(entry.ids, entry.size) : categoryRefs(entry.slug, entry.size);
}

/** The heading of the topic-page column that runs beside the topic's own feed.
 *
 *  Unlike everything in TAIL this block has NO fixed slug: it is scoped to the
 *  page's own term. It used to read `all-news`, the same feed the ranked
 *  ប្រធានបទពេញនិយម list beside it uses — so on all nine topic pages the two
 *  columns sat side by side showing the same articles in the same order. */
const RECENT = { heading: "អត្ថបទថ្មីៗ", size: 10 } as const;

/** The bare four-card strip at the top of a topic page (TagStrip). */
const LEAD = { heading: "ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ", size: 4 } as const;

/**
 * Each topic's បទយកការណ៍ term, keyed by the ព្រឹត្តិការណ៍ term its landing page
 * resolves to. Every topic in the nav carries both; the lead strip runs the
 * REPORTS one while the feed beside it stays on the news one.
 *
 * Term IDs, not slugs derived from the news slug, because two of the nine break
 * the `<topic>-news` → `<topic>-reports` pattern by dropping their prefix:
 * `entertainment-strange-news` pairs with `strange-reports`, and
 * `entertainment-movie-and-music-news` with `movie-and-music-reports`. String
 * surgery would query two slugs that do not exist and quietly render nothing.
 *
 * Two of these terms are EMPTY — entertainment-culture-reports (6914) and
 * life-style-architecture-reports (6916) hold no articles at all — so /culture
 * and /life-style/architecture get no strip. TopicHead drops it rather than
 * backfilling with news: a strip that silently changes what it contains is the
 * thing this file's TAIL comments keep warning about.
 */
const TOPIC_REPORTS: Record<string, number> = {
  "entertainment-celebrity-news": 980, // entertainment-celebrity-reports
  "entertainment-culture-news": 6914, // entertainment-culture-reports (empty)
  "entertainment-movie-and-music-news": 981, // movie-and-music-reports
  "entertainment-strange-news": 984, // strange-reports
  "life-style-architecture-news": 6916, // life-style-architecture-reports (empty)
  "life-style-health-and-beauty-news": 989, // life-style-health-and-beauty-reports
  "life-style-life-tips-news": 991, // life-style-life-tips-reports
  "life-style-love-and-relation-news": 987, // life-style-love-and-relation-reports
  "life-style-travel-news": 986, // life-style-travel-reports
};

/**
 * មាតិការសនិយម — a four-TAB widget, not a row with four links beside it.
 *
 * WordPress renders `ul#tabs-nav` plus four panels of four articles, switching
 * in place. We rendered one topic's four articles and turned the other three
 * tabs into links that NAVIGATE AWAY to those topics' landing pages, so 12 of
 * the 16 articles were never fetched at all. (The comment that used to live here
 * claimed the live tabs were dead links to `/home/#`. They are not — they are
 * working jQuery tabs. See AUDIT.md → CORRECTIONS.)
 *
 * The labels are the terms' own names, so they are read off the API rather than
 * written out here.
 */
const MATIKA = {
  heading: "មាតិការសនិយម",
  size: 4,
  slugs: [
    "life-style-love-and-relation-news",
    "life-style-health-and-beauty-news",
    "life-style-travel-news",
    "life-style-life-tips-news",
  ],
} as const;

/** One panel of the មាតិការសនិយម widget: a topic, and the four articles behind
 *  its tab. */
export interface MatikaTab {
  label: string;
  /** The topic's landing page — where "see all" for this tab goes. */
  href: string;
  items: ArticleRef[];
}

export interface LandingFeed {
  matika: { heading: string; tabs: MatikaTab[] };
  /** Section-page head; null on a topic page. `daily` feeds the daily-events
   *  widget — the SAME paged section the homepage runs, walking this section's
   *  own articles instead of the news root. It used to be three day tabs; see
   *  home/sections/DailyEventsSection for why the days went. */
  section: { daily: CardPage; topNews: Block; reports: Block } | null;
  /** Topic-page head; null on a section page. `lead` is the four-card strip at the
   *  top of the page — topic pages do NOT carry the ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ
   *  daily-events widget the home and section pages do. `latest` is the next
   *  window of the topic's own feed. */
  topic: { lead: Block; latest: Block; recent: Block; popular: RankedBlock } | null;
  tail: {
    programs: FeaturedProgram[];
    /** ចង់ដឹងរឿងគេ and បើកសោជីវិត — each a banner plus its episode rail. */
    features: ProgramFeature[];
    team: TeamMember[];
    /** Section pages only — on a topic page this block lives in the head. */
    popular: RankedBlock | null;
    interest: Block;
    lifeTips: Block;
    skincare: RankedBlock;
    love: Block;
    travel: Block;
    movies: RankedBlock;
    strange: Block;
    entertainment: Block;
  };
}

/**
 * The two programs every landing page features: a wide video banner, each
 * followed by that show's episode rail.
 *
 * NOT getFeaturedProgram(). That reads WordPress's single global "Featured
 * Program" setting — វនយាត្រា today — which the homepage and the program pages
 * share, so it can't be repointed for the landing pages alone.
 *
 * WordPress builds each banner as a Vodi `section-featured-movie` block, in which
 * the movie and the background art are chosen INDEPENDENTLY of each other: the
 * live pages put Obsok-branded art behind ចង់ដឹងរឿងគេ (the celebrity page is the
 * lone exception, using the show's own cover). That pairing isn't derivable —
 * `/web/program` returns the show's OWN backdrop, a different image — and no
 * endpoint exposes it, so the art is pinned here.
 *
 * `heading` is likewise editorial: the rail below ចង់ដឹងរឿងគេ is headed
 * "កម្មវិធីចង់ដឹងរឿងគេ", not the bare show name.
 */
const FEATURES = [
  {
    slug: "reaction",
    heading: "កម្មវិធីចង់ដឹងរឿងគេ",
    cover: "https://s3.ams.com.kh/infotainment/2021/09/Obsok-V2.1-scaled.jpg",
  },
  {
    slug: "unlock-the-life",
    heading: "បើកសោជីវិត",
    cover: "https://s3.ams.com.kh/infotainment/2021/09/UnlockV2.1-scaled.jpg",
  },
] as const;

/** A banner and the episode rail beneath it. */
export interface ProgramFeature {
  banner: TrailerProgram;
  heading: string;
  href: string;
  episodes: HomeCard[];
}

/** `/web/program` carries no `video` field, so a banner has no trailer behind
 *  its ▶. Live's answer (and ours): the ▶ NAVIGATES to the show's newest
 *  episode instead — `watchHref` below — where the player already works. */
async function getFeature(f: (typeof FEATURES)[number]): Promise<ProgramFeature | null> {
  const ref = await programBySlug(f.slug);
  if (!ref) return null;

  const href = programHref(ref.slug);
  const base = { cover: f.cover, href, video: null };

  const [meta, episodes] = await Promise.all([
    apiFetch<WpObjectEnvelope<WpProgram>>(`/wp/v2/web/program?id=${ref.postId}`, {
      revalidate: 3600,
      tags: ["program", `program:${ref.slug}`],
    })
      .then((env) => mapProgram(env.data, ref))
      // The registry's title is enough to render the band; the year is decoration.
      .catch(() => ({ title: ref.title, description: [] as string[], year: "" })),
    // The whole show, as live does — its rails run every episode (44 and 43).
    fetchEpisodeCards(ref.slug, ref.showId),
  ]);

  return {
    // Episode cards come newest first, so [0] is the episode live's ▶ plays.
    banner: { ...base, title: meta.title, description: meta.description, year: meta.year, watchHref: episodes[0]?.href },
    heading: f.heading,
    href,
    episodes,
  };
}

const ranked = (items: ArticleRef[]): PopularItem[] => items.map((r) => ({ slug: r.slug, title: r.title }));

/** Everything on a landing page: the head scoped to this term, and the fixed
 *  tail shared by all eleven. `newsPage` drives the section head's
 *  ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ pager and is ignored on a topic page, which has no
 *  such widget. */
export async function getLandingFeed(landing: Landing, newsPage = 1): Promise<LandingFeed> {
  const { term, level } = landing;
  const isSection = level === "section";

  // Term slug -> its listing URL, for every "see all" on the page.
  const terms = await getCategoryTerms();
  const bySlug = new Map(terms.map((t) => [t.slug, t]));
  const listing = (slug: string) => {
    const t = bySlug.get(slug);
    return t ? categoryHref(t.path) : categoryHref(slug);
  };
  const block = (key: keyof typeof TAIL, items: ArticleRef[]): Block => ({
    heading: TAIL[key].heading,
    href: listing(TAIL[key].slug),
    items,
  });
  const rank = (key: keyof typeof TAIL, items: ArticleRef[]): RankedBlock => ({
    heading: TAIL[key].heading,
    href: listing(TAIL[key].slug),
    items: ranked(items),
  });

  const [
    daily, own, leadReports, matika, topNews, reports, recent, popular,
    programs, features, team,
    interest, lifeTips, skincare, love, travel, movies, strange, entertainment,
  ] = await Promise.all([
    // The blocks scoped to the term you're on. A section leads with a large card
    // plus a 2x2 cluster (5). A topic leads with a strip of four and then runs
    // its feed again as a lead card + four rows (5), so it takes NINE and shows
    // two successive windows rather than the same articles twice.
    // ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ — SECTION pages only (topic pages don't carry the
    // widget). One page of this section's own feed, through the same block-paged
    // fetch the homepage uses; `slug` aggregates the term's whole subtree, which
    // is what the section's lead grid has always shown.
    // The `.catch` is deliberate: fetchCardPage throws now (on the homepage this
    // feed IS the page), but a landing page is a stack of many blocks, so here it
    // degrades and SectionHead's DailyEventsSection drops itself.
    isSection
      ? fetchCardPage(newsPage, {
          filter: { categorySlug: term.slug },
          revalidate: 3600,
          tags: ["articles", `category:${term.slug}`],
        }).catch(() => EMPTY_CARD_PAGE)
      : Promise.resolve<CardPage>(EMPTY_CARD_PAGE),
    // The topic's own feed, for ព័ត៌មានថ្មីបំផុត. Was fetched at 9 and split with
    // the lead strip above it; the strip now runs a different term, so this is
    // just its own five.
    isSection ? Promise.resolve([]) : categoryRefs(term.slug, 5),
    // The lead strip: the topic's បទយកការណ៍, not its ព្រឹត្តិការណ៍. [] for a topic
    // whose reports term is empty, and for section pages, which have no strip.
    !isSection && TOPIC_REPORTS[term.slug]
      ? categoryRefsByIds(String(TOPIC_REPORTS[term.slug]), LEAD.size)
      : Promise.resolve<ArticleRef[]>([]),
    // All four tabs, not just the one we used to show.
    Promise.all(MATIKA.slugs.map((slug) => categoryRefs(slug, MATIKA.size))),
    isSection ? tailRefs(TAIL.topNews) : [],
    isSection ? tailRefs(TAIL.reports) : [],
    // The topic's OWN recents — the block that used to duplicate the ranked list.
    isSection ? [] : categoryRefs(term.slug, RECENT.size),
    tailRefs(TAIL.popular),
    getFeaturedPrograms(POSTER_COUNT.landingBand),
    Promise.all(FEATURES.map(getFeature)).then((f) => f.filter((x) => x !== null)),
    getTeam(),
    tailRefs(TAIL.interest),
    tailRefs(TAIL.lifeTips),
    tailRefs(TAIL.skincare),
    tailRefs(TAIL.love),
    tailRefs(TAIL.travel),
    tailRefs(TAIL.movies),
    tailRefs(TAIL.strange),
    tailRefs(TAIL.entertainment),
  ]);

  // A topic page runs all 7; a section page shows the first 5. See TAIL.popular.
  const popularBlock = rank("popular", popular);
  const popularShort = { ...popularBlock, items: popularBlock.items.slice(0, 5) };

  // A section page runs a 2x2; a topic page, one row. See TAIL.interest.
  const interestBlock = block("interest", interest);
  const interestRow = { ...interestBlock, items: interestBlock.items.slice(0, 2) };

  const ownHref = categoryHref(term.path);

  return {
    matika: {
      heading: MATIKA.heading,
      tabs: MATIKA.slugs.map((slug, i) => {
        const t = bySlug.get(slug);
        return {
          label: t?.name ?? slug,
          href: t ? landingHref(t.path) : categoryHref(slug),
          items: matika[i],
        };
      }),
    },
    section: isSection
      ? { daily, topNews: block("topNews", topNews), reports: block("reports", reports) }
      : null,
    topic: isSection
      ? null
      : {
          // The strip is the topic's REPORTS (empty for culture/architecture, whose
          // reports terms hold nothing — TopicHead then drops it). TagStrip renders
          // items only, so the heading and href here go unused by it.
          lead: { heading: LEAD.heading, href: ownHref, items: leadReports },
          latest: { heading: "ព័ត៌មានថ្មីបំផុត", href: ownHref, items: own },
          recent: { heading: RECENT.heading, href: ownHref, items: recent },
          popular: popularBlock,
        },
    tail: {
      programs,
      features,
      team,
      popular: isSection ? popularShort : null,
      interest: isSection ? interestBlock : interestRow,
      lifeTips: block("lifeTips", lifeTips),
      skincare: rank("skincare", skincare),
      love: block("love", love),
      travel: block("travel", travel),
      movies: rank("movies", movies),
      strange: block("strange", strange),
      entertainment: block("entertainment", entertainment),
    },
  };
}
