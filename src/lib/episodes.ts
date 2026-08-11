// TV-show episodes, shared by the homepage grids, the program pages, and the
// episode pages.
//
// Every AMS program is a MasVideos `movie` post that carries a separate
// `tv_show` id — the two numbers differ, and only the tv_show id addresses the
// episode list. See src/lib/programs.ts for the id table.
//
// Episode identity is OURS, not WordPress's, for the same reason program slugs
// are (see the header of programs.ts). The live permalinks cannot be route keys:
// obsok's S2:E2 permalinks onto the program page itself and its S2:E1 onto
// /tv-show/obsok/, all 617 daily-feed episodes live at the site root rather than
// under their program, cicada-agent's episodes sit under /program/tamchetmomo/,
// and fact-check ships an /episode/testing/ row numbered "S01I100". So the route
// segment is derived from `episode_number`, here and nowhere else.
//
// `mapEpisode` lives in this file rather than in api/mappers.ts because it is
// not a field rename: the slug it produces depends on the whole episode list.

import { apiFetch } from "./api/client";
import type { HomeCard } from "./home-data";
import type { WpEpisode, WpListEnvelope } from "./api/wp-types";

export const episodeHref = (programSlug: string, episodeSlug: string) =>
  `/program/${programSlug}/${episodeSlug}`;

/** One request per this many episodes. Daily-feed, the largest show, has 617. */
const PAGE_SIZE = 200;
/** Runaway guard: 2,000 episodes. Nothing is close. */
const MAX_PAGES = 10;

export interface Episode {
  id: number;
  /** Our route segment, unique within a show: /program/<program>/<slug>. */
  slug: string;
  title: string;
  /** WordPress's raw label, e.g. "S1:E59". "" when the CMS has none. */
  episodeNumber: string;
  /** Index into the show's seasons. Unreliable — see WpEpisode.season_id. */
  seasonId: number;
  /** "" for the episodes with no featured image; CoverImage renders its empty state. */
  thumbnail: string;
  /** Hand-typed, e.g. "02:01 នាទី" — wrong on roughly half the episodes, but it
   *  is what the live rows print. "" until the plugin (≥1.5.0) sends it. */
  runTime: string;
  /** "13.04.2022", already in Phnom Penh time. "" until the plugin sends it. */
  releaseDate: string;
}

const PHNOM_PENH_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Phnom_Penh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** 1649782800 -> "13.04.2022".
 *
 *  The timestamp is midnight in Phnom Penh; Vodi formats it in UTC and so prints
 *  12.04.2022, a day early, on every episode page on the live site. We show the
 *  date the editor actually entered, which is also WordPress's own post date. */
export function formatReleaseDate(unixSeconds: number): string {
  if (!unixSeconds) return "";
  return PHNOM_PENH_DATE.format(new Date(unixSeconds * 1000)).replace(/\//g, ".");
}

const KHMER_DIGITS = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];

/** 12 -> "១២". */
const toKhmerDigits = (n: number) => String(n).replace(/\d/g, (d) => KHMER_DIGITS[Number(d)]);

/** The season an episode's LABEL claims: "S2:E26" -> 2. 0 when unlabelled.
 *
 *  The label, not `seasonId`: the meta field is an index editors have left wrong
 *  on plenty of episodes, while the label is what every listing on the site
 *  prints — grouping by anything else would contradict the text on the cards. */
export const seasonOf = (ep: Episode) => numberTuple(ep.episodeNumber)[0] ?? 0;

export interface Season {
  /** The season number as labelled, 0 for unlabelled episodes. */
  number: number;
  /** "រដូវកាលទី១". Unlabelled episodes get the catch-all "វគ្គទាំងអស់". */
  name: string;
  /** Ascending, same order fetchShowEpisodes returns. */
  episodes: Episode[];
}

/** A show's episodes grouped into seasons, newest season first — what fixed the
 *  grid that read "រដូវកាលទី ៣" above all three of the-fact's seasons. A
 *  single-season show comes back as one group. */
export function groupSeasons(episodes: Episode[]): Season[] {
  const byNumber = new Map<number, Episode[]>();
  for (const ep of episodes) {
    const n = seasonOf(ep);
    const group = byNumber.get(n);
    if (group) group.push(ep);
    else byNumber.set(n, [ep]);
  }
  return [...byNumber.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([number, eps]) => ({
      number,
      name: number > 0 ? `រដូវកាលទី${toKhmerDigits(number)}` : "វគ្គទាំងអស់",
      episodes: eps,
    }));
}

/** Every number in a label, in order: "S2:26:E555" -> [2, 26, 555]. */
function numberTuple(label: string): number[] {
  return (label.match(/\d+/g) ?? []).map(Number);
}

/** "S1:E59" -> "s1e59"; "S1E31" -> "s1e31"; "S2:26:E555" -> "s2-26-e555".
 *
 *  The plain season/episode pair is collapsed so the URLs we serve match the
 *  ones WordPress serves today for the 15 programs whose permalinks are sane.
 *  Any other shape keeps its groups hyphen-separated rather than guessing. */
function slugFromLabel(label: string): string {
  const tokens = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length === 2 && /^s\d+$/.test(tokens[0]) && /^e\d+$/.test(tokens[1])) {
    return tokens.join("");
  }
  return tokens.join("-");
}

/** Ascending, by the label's numbers read left to right. Episodes with no label
 *  have no place in the sequence, so they sort last. `id` breaks the ties that
 *  daily-feed's seven duplicate labels would otherwise leave to `sort`'s whim. */
function compareEpisodes(a: Episode, b: Episode): number {
  const x = numberTuple(a.episodeNumber);
  const y = numberTuple(b.episodeNumber);

  if (x.length === 0 || y.length === 0) {
    if (x.length !== y.length) return x.length === 0 ? 1 : -1;
  }

  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? -1) - (y[i] ?? -1);
    if (diff !== 0) return diff;
  }
  return a.id - b.id;
}

/** Slugs must be unique within a show, and stable as episodes are added.
 *
 *  An episode whose label yields no slug falls back to its post id — which puts
 *  label-derived and id-derived slugs in ONE namespace. They really can meet:
 *  daily-feed has an episode labelled simply "88", whose slug is the number 88.
 *  So uniqueness is enforced after the fallback, over the combined set, not
 *  before it over the labels alone.
 *
 *  Where two episodes end up sharing a slug, EVERY member of the colliding group
 *  takes an id suffix — never just the later one — so publishing a duplicate
 *  can't silently re-point the URL of an episode that already exists. */
function assignSlugs(rows: Episode[]): Episode[] {
  const withFallback = rows.map(row => (row.slug ? row : { ...row, slug: String(row.id) }));

  const counts = new Map<string, number>();
  for (const row of withFallback) counts.set(row.slug, (counts.get(row.slug) ?? 0) + 1);

  return withFallback.map(row =>
    (counts.get(row.slug) ?? 0) > 1 ? { ...row, slug: `${row.slug}-${row.id}` } : row,
  );
}

function mapEpisode(e: WpEpisode): Episode {
  return {
    id: e.id,
    slug: slugFromLabel(e.episode_number ?? ""),
    title: e.title,
    episodeNumber: e.episode_number ?? "",
    seasonId: e.season_id ?? 0,
    thumbnail: e.post_thumbnail || "",
    // Sent by the plugin from 1.5.0 on; "" from an older plugin, and the rows
    // simply omit their runtime/Added line until the update is deployed.
    runTime: (e.run_time ?? "").trim(),
    releaseDate: formatReleaseDate(e.release_date ?? 0),
  };
}

function fetchPage(tvShowId: number, page: number) {
  return apiFetch<WpListEnvelope<WpEpisode>>(
    `/wp/v2/web/tv-show-episodes?tv_show=${tvShowId}&page_no=${page}&page_size=${PAGE_SIZE}`,
    { revalidate: 3600, tags: ["episodes", `tv-show:${tvShowId}`] },
  );
}

/** Every episode of a show, ascending.
 *
 *  The episode page reuses this one list for both its season grid and its
 *  prev/next links, so neither costs an extra round trip. The upstream endpoint
 *  orders by post date, which is NOT episode order — 1-minute-for-health comes
 *  back E59, E64, E58 — so the sort here is load-bearing, not cosmetic.
 *
 *  THROWS. This list is an existence check as well as content: getEpisodePage
 *  looks its slug up here and calls `notFound()` on a miss, so an empty answer
 *  404s every episode of the show at once — and /program/<slug>/episodes IS this
 *  list, so an empty one is a page claiming a 617-episode show has none. Cases 2
 *  and 3 of the error-handling note in api/client.ts. The CARD helpers below
 *  degrade instead, because a rail is decoration. */
export async function fetchShowEpisodes(tvShowId: number): Promise<Episode[]> {
  const first = await fetchPage(tvShowId, 1);
  const pages = Math.min(first.total_page || 1, MAX_PAGES);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fetchPage(tvShowId, i + 2)),
  );

  const rows = [first, ...rest].flatMap(env => env.data ?? []).map(mapEpisode);
  return assignSlugs(rows).sort(compareEpisodes);
}

function toCard(ep: Episode, programSlug: string): HomeCard {
  return {
    slug: `episode-${ep.id}`,
    href: episodeHref(programSlug, ep.slug),
    src: ep.thumbnail,
    title: ep.title,
    ep: ep.episodeNumber,
  };
}

/** One season's worth of episode cards for the program overview's season browser
 *  (the tab strip below វគ្គថ្មីៗ). */
export interface SeasonCards {
  /** The season number as labelled, 0 for the unlabelled catch-all. */
  number: number;
  /** "រដូវកាលទី១", or "វគ្គទាំងអស់" for the unlabelled group — the tab label. */
  name: string;
  /** Ascending (E1 first), capped at SEASON_CARD_CAP. */
  cards: HomeCard[];
  /** The season's full episode count, before the cap — drives the "see all" link. */
  total: number;
}

/** A season carousel is a scroll track, not the whole episodes page: cap it so a
 *  617-episode show doesn't ship every card into one strip. Past the cap the
 *  section links out to /program/<slug>/episodes, same as SeasonGrid. */
const SEASON_CARD_CAP = 30;

/** A show's episodes grouped into per-season card lists for the overview browser.
 *
 *  Tabs read oldest→newest (រដូវកាលទី១, ទី២, …) with the unlabelled catch-all
 *  last; groupSeasons returns them newest-first, so the order is flipped here.
 *  Within a season the cards keep the show's own ascending order. */
export function toSeasonCards(episodes: Episode[], programSlug: string): SeasonCards[] {
  return groupSeasons(episodes)
    .map((s) => ({
      number: s.number,
      name: s.name,
      total: s.episodes.length,
      cards: s.episodes.slice(0, SEASON_CARD_CAP).map((ep) => toCard(ep, programSlug)),
    }))
    .sort((a, b) => (a.number === 0 ? 1 : b.number === 0 ? -1 : a.number - b.number));
}

/** The show's seasons as card lists, for the program overview. Reuses the same
 *  cached episode fetch as fetchEpisodeCards, so it costs no extra round trip.
 *
 *  Returns [] on error: the season browser is one section of the overview, and
 *  the section only renders for 2+ seasons anyway, so an empty list is already a
 *  state it handles. */
export async function fetchSeasonCards(programSlug: string, tvShowId: number): Promise<SeasonCards[]> {
  const episodes = await fetchShowEpisodes(tvShowId).catch(() => []);
  return toSeasonCards(episodes, programSlug);
}

/** Which end of the show a card list is taken from, and therefore its order.
 *
 *  "newest" (E-last first) is what a what's-new strip wants and what every grid
 *  but one uses. "oldest" (E1 first) is for a shelf presenting the show as a
 *  series to start watching — the homepage health grid. */
export type EpisodeCardOrder = "newest" | "oldest";

/** A show's episodes as cards, for the homepage grids, the program page's
 *  carousel and the landing pages' rails. Omit `size` for every episode the show
 *  has — which is what the landing rails want (live runs all 44 of ចង់ដឹងរឿងគេ).
 *
 *  `order` picks WHICH episodes as well as their order: "newest" takes the last
 *  `size` and shows them newest first, "oldest" takes the first `size` from E1.
 *  Note the upstream endpoint can't do either — it orders by post date, which is
 *  not episode order, and registers no `order` param. The ordering that matters
 *  is `compareEpisodes` above, over the whole show.
 *
 *  This goes through `fetchShowEpisodes` rather than asking the API for `size`
 *  rows, because a card's href has to be the slug the route will actually
 *  resolve — and `assignSlugs` can only spot a collision by seeing the whole
 *  show. Fetching a page of 18 in isolation would emit `s2-25-e79` for a
 *  daily-feed episode the router knows as `s2-25-e79-84312`, and every one of
 *  those links would 404. So capping here costs nothing: the whole list is
 *  already in hand.
 *
 *  Returns [] on error so a failing grid degrades to nothing rather than taking
 *  the page down — every caller is a rail or a shelf beside other content, never
 *  the reason a page exists. */
export async function fetchEpisodeCards(
  programSlug: string,
  tvShowId: number,
  size?: number,
  order: EpisodeCardOrder = "newest",
): Promise<HomeCard[]> {
  const episodes = await fetchShowEpisodes(tvShowId).catch(() => []);

  // fetchShowEpisodes is ascending, so "oldest" is already the right order.
  if (order === "oldest") {
    const first = size === undefined ? episodes : episodes.slice(0, size);
    return first.map(ep => toCard(ep, programSlug));
  }

  const newest = size === undefined ? episodes : episodes.slice(-size);
  return [...newest].reverse().map(ep => toCard(ep, programSlug));
}
