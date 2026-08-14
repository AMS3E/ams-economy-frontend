import { getEpisodePreview } from "./episode";
import { fetchEpisodeRail, fetchEpisodeVideoCover, type RailEpisode } from "./episodes";
import { getFeaturedMovie, getProgram, type Program } from "./programs";

const SLUG = "khmer-insider";
const MOVIE_POST_ID = 2930;
const HERO_IMAGE_ID = 79854;
const TV_SHOW_ID = 21395;

const VERIFIED_VIDEO_COVERS: Record<number, string> = {
  125153:
    "https://i.vimeocdn.com/video/1936314855-096fa5a03eec7aef6958d9bba111e11797003de81e097ffb86a8afde3e7e301e-d_1280?region=us",
  132563:
    "https://i.vimeocdn.com/video/1972991921-459a0ce86815948d73cb8a605567cc49280d20f3d45e14fd9adbd8c4fbc626fd-d_1280?region=us",
};

const hrefSlug = (href: string) => href.split("/").filter(Boolean).at(-1)?.toLowerCase() ?? "";

export interface KhmerInsiderWatchData {
  program: Program;
  episodes: RailEpisode[];
  current: RailEpisode | null;
  episode: Awaited<ReturnType<typeof getEpisodePreview>>;
  videoCover: string;
}

/** Shared data path for the overview and `/program/khmer-insider/<episode>`.
 * It deliberately uses the legacy fragment rail because the structured episode
 * list and detail routes currently 404 on production. */
export async function getKhmerInsiderWatchData(episodeSlug?: string): Promise<KhmerInsiderWatchData> {
  const [rawProgram, rail, feature] = await Promise.all([
    getProgram(SLUG),
    fetchEpisodeRail(TV_SHOW_ID),
    getFeaturedMovie(MOVIE_POST_ID, HERO_IMAGE_ID),
  ]);

  const program = {
    ...rawProgram,
    description: rawProgram.description.length ? rawProgram.description : feature?.description ?? [],
    poster: rawProgram.poster || feature?.poster || "",
    backdrop: rawProgram.backdrop || feature?.backdrop || "",
    year: rawProgram.year || feature?.year || "2023",
    schedule: rawProgram.schedule || "ផ្សាយរៀងរាល់ថ្ងៃសុក្រ ម៉ោង 12:30 ថ្ងៃត្រង់",
  };
  const wanted = episodeSlug?.toLowerCase();
  const current = wanted
    ? rail.episodes.find(item => hrefSlug(item.href) === wanted) ?? null
    : rail.episodes[0] ?? null;

  const [episode, resolvedCover] = current
    ? await Promise.all([getEpisodePreview(current.id), fetchEpisodeVideoCover(current.href)])
    : [null, ""];

  return {
    program,
    episodes: rail.episodes,
    current,
    episode,
    videoCover: resolvedCover || (current ? VERIFIED_VIDEO_COVERS[current.id] ?? "" : ""),
  };
}
