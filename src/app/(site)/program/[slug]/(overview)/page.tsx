import type { Metadata } from "next";
import { css, cx } from "@/styled-system/css";
import ProgramHero from "@/components/program/ProgramHero";
import ProgramAbout from "@/components/program/ProgramAbout";
import EpisodeCarousel from "@/components/program/EpisodeCarousel";
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
import { getHomeFeed } from "@/lib/home-data";
import { getFeaturedPrograms, POSTER_COUNT } from "@/lib/navigation";
import { kbPrasacFullLandscape } from "@/lib/promos";
import { notFound } from "next/navigation";
import { getProgram, getProgramSlugs, programHref, routedProgram } from "@/lib/programs";
import { categoryRefs } from "@/lib/articles";

type Params = { params: Promise<{ slug: string }> };

// ISR: revalidate hourly; on-demand invalidation via /api/revalidate.
export const revalidate = 3600;

// The registry is DYNAMIC (all published movies/tv_shows — see lib/programs):
// known programs prebuild below, and a program published after the build gets
// its page on first visit. The 404 for a bogus slug fires in generateMetadata,
// which runs before the first chunk streams — so it's still a real 404 status,
// not the mid-stream 200+noindex that dynamicParams=false used to guard.
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getProgramSlugs()).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const ref = await routedProgram(slug);
  if (!ref) notFound();
  return { title: ref.title };
}

export default async function ProgramPage({ params }: Params) {
  const { slug } = await params;

  // getProgram() notFound()s on an unknown slug, so everything alongside it is
  // only ever wasted work for a 404 — cheap, and it keeps the page a single round
  // trip. Everything below ProgramNews is the homepage's own furniture, same as
  // the episode page carries; the extra requests are all ISR-cached.
  const [program, entertainment, mixed, feed, programs] = await Promise.all([
    getProgram(slug),
    categoryRefs("entertainment-news", 3),
    categoryRefs("all-news", 3),
    getHomeFeed(),
    getFeaturedPrograms(POSTER_COUNT.carousel),
  ]);

  return (
    <>
      <ProgramHero backdrop={program.backdrop} poster={program.poster} />

      <div className={cx(container, css({ paddingBottom: "48px" }))}>
        <ProgramAbout
          title={program.title}
          description={program.description}
          poster={program.poster}
          year={program.year}
          schedule={program.schedule}
        />
        <EpisodeCarousel episodes={program.episodes} />
        <SeasonTabs seasons={program.seasons} programSlug={slug} />

        <div className={css({ paddingTop: "56px" })}>
          <AdEmbed promo={kbPrasacFullLandscape} />
        </div>

        <ProgramNews entertainment={entertainment} mixed={mixed} />
      </div>

      {/* No pager: this route is statically prerendered, and a pager would need
          request-time searchParams. It shows page one, same as it always did. */}
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
