import type { Metadata } from "next";
import Link from "next/link";
import { css, cx } from "@/styled-system/css";
import EpisodeStage from "@/components/episode/EpisodeStage";
import EpisodeMeta from "@/components/episode/EpisodeMeta";
import SeasonTabs from "@/components/program/SeasonTabs";
import ProgramNews from "@/components/program/ProgramNews";
import PosterBand from "@/components/home/PosterBand";
import DailyEventsSection from "@/components/home/sections/DailyEventsSection";
import LatestReportsSection from "@/components/home/sections/LatestReportsSection";
import LifestyleSection from "@/components/home/sections/LifestyleSection";
import VideoFeatureStrip from "@/components/home/sections/VideoFeatureStrip";
import HealthSection from "@/components/home/sections/HealthSection";
import ObsokSection from "@/components/home/sections/ObsokSection";
import PopularProgramsBand from "@/components/home/sections/PopularProgramsBand";
import AdEmbed from "@/components/ui/AdEmbed";
import { container } from "@/components/layout/shared";
import { getEpisodePage } from "@/lib/episode";
import { seasonOf, toSeasonCards } from "@/lib/episodes";
import { getHomeFeed } from "@/lib/home-data";
import { getFeaturedPrograms, POSTER_COUNT } from "@/lib/navigation";
import { kbPrasacFullLandscape } from "@/lib/promos";
import { programHref, routedProgram } from "@/lib/programs";
import { categoryRefs } from "@/lib/articles";

type Params = { params: Promise<{ slug: string; episode: string }> };

// ISR: revalidate hourly; on-demand invalidation via /api/revalidate.
export const revalidate = 3600;

// ~1,131 episodes across the 18 programs — 617 of them daily-feed — so nothing
// prebuilds and every page is generated on first visit, then cached. Next requires
// the empty array: return nothing at all and the route silently goes fully dynamic.
export function generateStaticParams() {
  return [];
}

const crumb = css({ color: "muted", textDecoration: "none", _hover: { color: "brand.blue" } });

// This route deliberately has no loading.tsx, and the program page's skeleton was
// moved into a (overview) route group so it no longer wraps this one. A Suspense
// fallback would flush the response before `getEpisodePage` can decide, and a
// `notFound()` after the first byte can only answer 200 + `noindex`.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, episode } = await params;
  if (!(await routedProgram(slug))) return {};

  const page = await getEpisodePage(slug, episode);
  return { title: `${page.episode.episodeNumber} — ${page.showTitle}` };
}

export default async function EpisodePageRoute({ params }: Params) {
  const { slug, episode } = await params;

  // Everything from DailyEventsSection down is the homepage's own furniture.
  // Live's episode page carries none of it — its <main> is a bare watch template
  // — but keeping the sections here is a deliberate owner decision (see AUDIT.md
  // → DECISIONS). The extra requests are ISR-cached.
  const [page, entertainment, mixed, feed, programs] = await Promise.all([
    getEpisodePage(slug, episode),
    categoryRefs("entertainment-news", 3),
    categoryRefs("all-news", 3),
    getHomeFeed(),
    getFeaturedPrograms(POSTER_COUNT.carousel),
  ]);

  return (
    <>
      <div className={cx(container, css({ paddingBottom: "48px" }))}>
        <nav
          className={css({
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "7px",
            fontSize: "12.5px",
            color: "muted",
            marginTop: "22px",
          })}>
          <Link href='/' className={crumb}>
            ទំព័រដើម
          </Link>
          <span className={css({ opacity: 0.6 })}>›</span>
          <Link href={programHref(page.program.slug)} className={crumb}>
            {page.showTitle}
          </Link>
          <span className={css({ opacity: 0.6 })}>›</span>
          <span className={css({ color: "brand.blue" })}>{page.episode.title}</span>
        </nav>

        <EpisodeStage
          video={page.video}
          title={page.episode.title}
          programSlug={page.program.slug}
          prev={page.prev}
          next={page.next}
        />

        <EpisodeMeta
          showTitle={page.showTitle}
          episodeNumber={page.episode.episodeNumber}
          title={page.episode.title}
          runTime={page.runTime}
          releaseDate={page.releaseDate}
          description={page.description}
        />

        <div className={css({ paddingTop: "48px" })}>
          <AdEmbed promo={kbPrasacFullLandscape} />
        </div>

        {/* Season browser: the same tab slider the program overview uses, but
            opened to the episode being watched with its card highlighted. It
            replaced a stack of per-season grids that used to sit at the very
            foot of the page. `page.season` is the whole show, ascending. */}
        <SeasonTabs
          seasons={toSeasonCards(page.season, page.program.slug)}
          programSlug={page.program.slug}
          currentId={page.episode.id}
          currentSeason={seasonOf(page.episode)}
          alwaysShow
        />

        <ProgramNews entertainment={entertainment} mixed={mixed} />
      </div>

      {/* No pager — see the program overview page. */}
      <DailyEventsSection cards={feed.daily.cards} />
      <LatestReportsSection items={feed.latest} />
      <LifestyleSection items={feed.lifestyle} />
      <PosterBand posters={programs.map(p => ({ src: p.image, title: p.title, year: p.year, href: programHref(p.slug) }))} />
      <VideoFeatureStrip program={feed.featured} />
      <HealthSection items={feed.healthGrid} />
      <ObsokSection items={feed.obsokGrid} />
      <PopularProgramsBand
        popular={programs.slice(0, POSTER_COUNT.popular)}
        special={programs.slice(0, POSTER_COUNT.special)}
      />
    </>
  );
}
