import { css, cx } from "@/styled-system/css";
import { container } from "@/components/layout/shared";
import SectionHeader from "@/components/ui/SectionHeader";
import VideoFeatureStrip from "@/components/home/sections/VideoFeatureStrip";
import EpisodeCarousel from "@/components/program/EpisodeCarousel";
import type { LandingFeed } from "@/lib/landing-data";
import { CardGrid, CardRow, LeadBesideRows, Ranked, Thumbs } from "./blocks";
import ProgramBand from "./ProgramBand";
import TeamList from "./TeamList";

const stack = css({ display: "flex", flexDirection: "column", gap: "44px" });

/**
 * The run of blocks below every landing page's own head — identical on all
 * eleven, each block fixed to the category its heading names rather than to the
 * page's term. See the TAIL comment in src/lib/landing-data.ts for why.
 *
 * The article half is three grids, not one: the first row is narrow-left, and
 * then the proportions INVERT for the second. Running it as a single grid would
 * force every block into one of two fixed column widths, which is what the design
 * doesn't do.
 *
 * `popular` is present only on section pages; a topic page renders that block in
 * its head instead, beside its own feed.
 */
export default function LandingTail({ tail }: { tail: LandingFeed["tail"] }) {
  return (
    <>
      <ProgramBand programs={tail.programs} />

      {/* ចង់ដឹងរឿងគេ and បើកសោជីវិត: each a wide banner with that show's episode
          rail directly beneath it. */}
      {tail.features.map((f) => (
        <div key={f.href}>
          <VideoFeatureStrip program={f.banner} />
          <div className={container}>
            <EpisodeCarousel episodes={f.episodes} title={f.heading} seeAllHref={f.href} />
          </div>
        </div>
      ))}

      {/* Row 1 — narrow left (ranked + team), wide right (the interest cards). */}
      <div
        className={cx(
          container,
          css({
            marginTop: "44px",
            display: "grid",
            gridTemplateColumns: { base: "1fr", lg: "minmax(0,1fr) minmax(0,2fr)" },
            gap: "44px 34px",
            alignItems: "start",
          }),
        )}
      >
        <div className={stack}>
          {tail.popular && <Ranked block={tail.popular} />}
          <div>
            <SectionHeader variant="underline" title="ក្រុមការងារ" titleSize="22px" seeAllHref="/author" />
            <TeamList members={tail.team} />
          </div>
        </div>

        <CardGrid block={tail.interest} sizes="(max-width: 1024px) 100vw, 440px" />
      </div>

      {/* Row 2 — proportions flip: wide left, narrow right. */}
      <div
        className={cx(
          container,
          css({
            marginTop: "44px",
            display: "grid",
            gridTemplateColumns: { base: "1fr", lg: "minmax(0,2fr) minmax(0,1fr)" },
            gap: "44px 34px",
            alignItems: "start",
          }),
        )}
      >
        <div className={stack}>
          <LeadBesideRows block={tail.lifeTips} sizes="(max-width: 1024px) 100vw, 440px" />
          <CardRow block={tail.love} />
          <CardRow block={tail.travel} />
        </div>

        <div className={stack}>
          <Ranked block={tail.skincare} />
          <Ranked block={tail.movies} />
          <Thumbs block={tail.strange} />
        </div>
      </div>

      {/* Row 3 — full width. */}
      <div className={cx(container, css({ marginTop: "44px", marginBottom: "48px" }))}>
        <CardRow block={tail.entertainment} />
      </div>
    </>
  );
}
