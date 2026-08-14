import { css, cx } from "@/styled-system/css";
import { container } from "@/components/layout/shared";
import SectionHeader from "@/components/ui/SectionHeader";
import ReviveAdSlot from "@/components/ads/revive/ReviveAdSlot";
import { reviveFullLandscape } from "@/components/ads/revive/zones";
import VideoFeatureStrip from "@/components/home/sections/VideoFeatureStrip";
import EpisodeCarousel from "@/components/program/EpisodeCarousel";
import type { LandingFeed } from "@/lib/landing-data";
import { CardGrid, Ranked } from "./blocks";
import TeamList from "./TeamList";
import KhmerInsiderFeature from "./KhmerInsiderFeature";
import Cambodia360Feature from "./Cambodia360Feature";
import EconomicAdSection from "./EconomicAdSection";
import InnovationPopularSection from "./InnovationPopularSection";
import RealEstateBusinessFinanceSection from "./RealEstateBusinessFinanceSection";
import CommercialArticlesSection from "./CommercialArticlesSection";

/**
 * The run of blocks below every landing page's own head — identical on all
 * eleven, each block fixed to the category its heading names rather than to the
 * page's term. See the TAIL comment in src/lib/landing-data.ts for why.
 *
 * `popular` is present only on section pages; a topic page renders that block in
 * its head instead, beside its own feed.
 */
export default function LandingTail({ tail }: { tail: LandingFeed["tail"] }) {
  return (
    <>
      <KhmerInsiderFeature />

      {/* Team and reader-interest cards sit directly beneath Khmer Insider. */}
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
        <div>
          <SectionHeader variant="underline" title="ក្រុមការងារ" titleSize="22px" seeAllHref="/author" />
          <TeamList members={tail.team} />
        </div>
        <CardGrid
          block={{ ...tail.interest, items: tail.interest.items.slice(0, 2) }}
          sizes="(max-width: 1024px) 100vw, 440px"
        />
      </div>

      <Cambodia360Feature />

      <EconomicAdSection />

      <InnovationPopularSection />

      <RealEstateBusinessFinanceSection />

      <div className={cx(container, css({ marginTop: "44px" }))}>
        <ReviveAdSlot zone={reviveFullLandscape} />
      </div>

      <CommercialArticlesSection />

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

      {tail.popular && (
        <div className={cx(container, css({ marginTop: "44px" }))}>
          <Ranked block={tail.popular} />
        </div>
      )}
    </>
  );
}
