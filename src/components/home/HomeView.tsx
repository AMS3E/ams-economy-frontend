import HeroEmbed from "@/components/home/HeroEmbed";
import PosterBand from "@/components/home/PosterBand";
import DailyEventsSection from "@/components/home/sections/DailyEventsSection";
import LatestReportsSection from "@/components/home/sections/LatestReportsSection";
import LifestyleSection from "@/components/home/sections/LifestyleSection";
import VideoFeatureStrip from "@/components/home/sections/VideoFeatureStrip";
import HealthSection from "@/components/home/sections/HealthSection";
import ObsokSection from "@/components/home/sections/ObsokSection";
import PopularProgramsBand from "@/components/home/sections/PopularProgramsBand";
import { getFeaturedPrograms, POSTER_COUNT } from "@/lib/navigation";
import { programHref } from "@/lib/programs";
import { getHomeFeed } from "@/lib/home-data";

/**
 * The homepage body, shared by `/` (page one) and `/page/[n]` (the rest).
 *
 * IT LIVES HERE SO THE HOMEPAGE CAN BE PRERENDERED. The pager used to be
 * `?page=N`, read off the page's `searchParams` prop — and `searchParams` is a
 * request-time API, so touching it made `/` render per request and kept it out
 * of the prerender manifest entirely. That is only a problem in one window, but
 * a real one: with no prerendered copy there is no last-good page to fall back
 * on, so a WordPress outage beginning right after a deploy (before anything has
 * warmed the fetch cache) answers 500 rather than a stale homepage.
 *
 * Suspense does NOT fix that here. Wrapping the searchParams read in a boundary
 * so the rest of the page can prerender around it is Partial Prerendering, and
 * PPR only exists when `cacheComponents: true`. This app runs the classic ISR
 * model (see project-context §5), where reading searchParams anywhere in the
 * tree makes the whole route dynamic no matter where the boundary sits.
 *
 * So the page number moved into the URL PATH, which is what the category and
 * author pagers already do (`/category/…/page/3` — see splitPage). `/` now reads
 * no request-time API at all and prerenders; deeper pages are their own route
 * and stay server-rendered, so they are still crawlable and linkable.
 */
export default async function HomeView({ page }: { page: number }) {
  // One ordered poster list; each band below takes the prefix live cuts it at.
  // `true`: ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ is this page's subject, so a failed read throws
  // and the last good homepage keeps serving. Every other section drops itself
  // when its data is missing — nothing on this page is ever stood in for.
  const [programs, feed] = await Promise.all([getFeaturedPrograms(), getHomeFeed(page, true)]);

  return (
    <>
      <HeroEmbed />
      <DailyEventsSection
        cards={feed.daily.cards}
        page={feed.daily.page}
        totalPages={feed.daily.totalPages}
        pageStyle="segment"
      />
      <LatestReportsSection items={feed.latest} />
      <LifestyleSection items={feed.lifestyle} />
      <VideoFeatureStrip program={feed.featured} />
      {/* From the first episode, not the latest — the homepage shelf presents the
          show as a series to start. The program/episode pages use healthGrid. */}
      <HealthSection items={feed.healthFromStart} />
      <ObsokSection items={feed.obsokGrid} />
      <PosterBand
        posters={programs.slice(0, POSTER_COUNT.carousel).map((p) => ({
          src: p.image,
          title: p.title,
          year: p.year,
          href: programHref(p.slug),
        }))}
      />
      {/* The ranked list and the poster grid beside it are different lengths on
          live (9 and 8). They were both fed the same nine-item array, so ours
          came out identical to each other. */}
      <PopularProgramsBand
        popular={programs.slice(0, POSTER_COUNT.popular)}
        special={programs.slice(0, POSTER_COUNT.special)}
      />
    </>
  );
}
