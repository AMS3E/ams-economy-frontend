import HeroEmbed from "@/components/home/HeroEmbed";
import BusinessInnovationSection from "@/components/home/sections/BusinessInnovationSection";
import DailyEventsSection from "@/components/home/sections/DailyEventsSection";
import EntertainmentSection from "@/components/home/sections/EntertainmentSection";
import FeaturedMovieHero, { type FeaturedMovieStyle } from "@/components/program/FeaturedMovieHero";
import EpisodeCarousel from "@/components/program/EpisodeCarousel";
import LatestNewsSection from "@/components/home/sections/LatestNewsSection";
import LatestReportsSection from "@/components/home/sections/LatestReportsSection";
import MatikaSection from "@/components/home/sections/MatikaSection";
import RealEstateFinanceSection from "@/components/home/sections/RealEstateFinanceSection";
import LifestyleSection from "@/components/home/sections/LifestyleSection";
import VideoFeatureStrip from "@/components/home/sections/VideoFeatureStrip";
import HealthSection from "@/components/home/sections/HealthSection";
import ObsokSection from "@/components/home/sections/ObsokSection";
import ReviveAdSlot from "@/components/ads/revive/ReviveAdSlot";
import { reviveFullLandscape, reviveHalfLandscape } from "@/components/ads/revive/zones";
import SectionHeader from "@/components/ui/SectionHeader";
import TeamList from "@/components/landing/TeamList";
import { container } from "@/components/layout/shared";
import { css, cx } from "@/styled-system/css";
import { getFeaturedMovie, programHref } from "@/lib/programs";
import { fetchEpisodeRail } from "@/lib/episodes";
import { getTeam } from "@/lib/authors";
import { getHomeFeed } from "@/lib/home-data";

/** កម្ពុជា 360° — the Vodi "section-featured-movie" block's own payload for this
 *  placement (movie + background art chosen independently; see getFeaturedMovie
 *  in programs.ts). Pinned here, not in home-data.ts, to keep that module free
 *  of a dependency on programs.ts.
 *
 *  `style` overrides FeaturedMovieHero's look for this one placement — title
 *  pill colour/size, background art, ▶ colour/position — see FeaturedMovieStyle.
 *  Left empty here (everything derives from the movie itself), but a future
 *  pin can set only the fields it wants to change. */
const HOME_FEATURED_MOVIE: { postId: number; bgImageId?: number; style?: FeaturedMovieStyle,titleTextColor?:FeaturedMovieStyle } = {
  postId: 2930,
  bgImageId: 79854,
  style: {
    titleColor: "#a09e96",
    titleTextColor: "#161515",
    iconColor: "#777707",
    playlistButtonColor: "rgba(206, 193, 193, 0.7)",
    playlistButtonBorderColor: "rgba(206, 193, 193, 0.7)",
    playlistButtonTextColor: "#161515",
    iconPadding: "20px 40px",
    iconPosition: "center",
    iconOffsetX: "61%",
    iconOffsetY: "37%",
    watchButtonColor: "#a09e96",
    descriptionColor: "#161515",
  },
};

/** កម្មវិធីពិសេស Khmer Insider — an episode rail below the hero above, via
 *  fetchEpisodeRail's HTML-fragment endpoint (see that function's doc
 *  comment). `tvShowId` is pinned rather than looked up, same reason as
 *  HOME_FEATURED_MOVIE: the movie post carries no visible show-id meta on
 *  this backend.
 *
 *  An earlier version of this pin went through fetchSeasonCards, which uses
 *  the SAME broken `tv-show-episodes` list endpoint AUDIT.md documents as
 *  404ing on this backend — so it always rendered nothing. fetchEpisodeRail
 *  replaces it; confirmed working on this show's id (21395) as well as
 *  Financial Street's (88448), which briefly stood in for it here. */
const KHMER_INSIDER_RAIL = {
  programSlug: "khmer-insider",
  tvShowId: 21395,
  heading: "កម្មវិធីពិសេស Khmer insider",
};



const HOME_FEATURED_MOVIE2: { postId: number; bgImageId?: number; style?: FeaturedMovieStyle,titleTextColor?:FeaturedMovieStyle } = {
  postId: 24747,
  bgImageId: 79951,
  style: {
    titleColor: "#a09e96",
    titleTextColor: "#161515",
    iconColor: "#777707",
    playlistButtonColor: "rgba(206, 193, 193, 0.7)",
    playlistButtonBorderColor: "rgba(206, 193, 193, 0.7)",
    playlistButtonTextColor: "#161515",
    iconPadding: "20px 40px",
    iconPosition: "center",
    iconOffsetX: "61%",
    iconOffsetY: "35%",
    watchButtonColor: "#a09e96",
    descriptionColor: "#161515",
  },
};

/** Second episode rail — see KHMER_INSIDER_RAIL above. tvShowId 47504 is
 *  Cambodia 360°'s tv_show post — confirmed 2026-08-12 via
 *  /wp/v2/tv_show/47504 (title "កម្ពុជា 360°", link .../program/series/
 *  cambodia-360). `programSlug` is the MOVIE post's own clean slug
 *  ("cambodia-360", id 24747 — same movie/tv_show split as Khmer Insider's
 *  2930/21395), which is what our own program registry and programHref key
 *  on, not the tv_show post's own percent-encoded Khmer slug. */
const KHMER_INSIDER_RAIL2 = {
  programSlug: "cambodia-360",
  tvShowId: 47504,
  heading: "កម្មវិធី កម្ពុជា 360°",
};

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
  // `true`: ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ is this page's subject, so a failed read throws
  // and the last good homepage keeps serving. Every other section drops itself
  // when its data is missing — nothing on this page is ever stood in for.
  const [feed, featuredMovie, featuredMovie2, khmerInsiderRail, khmerInsiderRail2, team] = await Promise.all([
    getHomeFeed(page, true),
    getFeaturedMovie(HOME_FEATURED_MOVIE.postId, HOME_FEATURED_MOVIE.bgImageId),
    getFeaturedMovie(HOME_FEATURED_MOVIE2.postId, HOME_FEATURED_MOVIE2.bgImageId),
    fetchEpisodeRail(KHMER_INSIDER_RAIL.tvShowId),
    fetchEpisodeRail(KHMER_INSIDER_RAIL2.tvShowId),
    getTeam(),
  ]);

  return (
    <>
      <HeroEmbed />
      <DailyEventsSection
        cards={feed.daily.cards}
        page={feed.daily.page}
        totalPages={feed.daily.totalPages}
        pageStyle="segment"
      />
      <LatestNewsSection latest={feed.latestNews} recent={feed.recentArticles} />
      <BusinessInnovationSection innovation={feed.innovation} economic={feed.economic} />
      <RealEstateFinanceSection realestate={feed.realestate} business={feed.business} finance={feed.finance} />
      <MatikaSection heading={feed.matika.heading} tabs={feed.matika.tabs} />
      <EntertainmentSection items={feed.entertainment} />
      {featuredMovie && <FeaturedMovieHero movie={featuredMovie} style={HOME_FEATURED_MOVIE.style} />}
      {khmerInsiderRail.episodes.length > 0 && (
        <div className={cx(container, css({ paddingBottom: "8px" }))}>
          <EpisodeCarousel
            episodes={khmerInsiderRail.episodes.map((e) => ({
              slug: `episode-${e.id}`,
              href: e.href,
              src: e.thumbnail,
              title: e.title,
              ep: e.label,
            }))}
            title={KHMER_INSIDER_RAIL.heading}
            seeAllHref={programHref(KHMER_INSIDER_RAIL.programSlug)}
            unoptimized
            autoScrollMs={5000}
          />
        </div>
      )}
      {featuredMovie2 && <FeaturedMovieHero movie={featuredMovie2} style={HOME_FEATURED_MOVIE2.style} />}
      {khmerInsiderRail2.episodes.length > 0 && (
        <div className={cx(container, css({ paddingBottom: "8px" }))}>
          <EpisodeCarousel
            episodes={khmerInsiderRail2.episodes.map((e) => ({
              slug: `episode-${e.id}`,
              href: e.href,
              src: e.thumbnail,
              title: e.title,
              ep: e.label,
            }))}
            title={KHMER_INSIDER_RAIL2.heading}
            seeAllHref={programHref(KHMER_INSIDER_RAIL2.programSlug)}
            unoptimized
          />
        </div>
      )}
      <div
        className={cx(
          container,
          css({
            display: "grid",
            gridTemplateColumns: { base: "1fr", lg: "minmax(0,2fr) minmax(0,1fr)" },
            gap: "34px",
            alignItems: "start",
            paddingBottom: "44px",
          }),
        )}
      >
        <ReviveAdSlot zone={reviveHalfLandscape} />
        <div>
          <SectionHeader title="ក្រុមការងារ" titleSize="22px" seeAllHref="/author" />
          <TeamList members={team} />
        </div>
      </div>
      <div className={cx(container, css({ paddingBottom: "8px" }))}>
        <ReviveAdSlot zone={reviveFullLandscape} />
      </div>
      <LatestReportsSection items={feed.latest} />
      <LifestyleSection items={feed.lifestyle} />
      <VideoFeatureStrip program={feed.featured} />
      {/* From the first episode, not the latest — the homepage shelf presents the
          show as a series to start. The program/episode pages use healthGrid. */}
      <HealthSection items={feed.healthFromStart} />
      <ObsokSection items={feed.obsokGrid} />
    </>
  );
}
