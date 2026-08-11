import { css, cx } from "@/styled-system/css";
import { container } from "@/components/layout/shared";
import DailyEventsSection from "@/components/home/sections/DailyEventsSection";
import type { LandingFeed } from "@/lib/landing-data";
import { CardColumn, LeadAndRows } from "./blocks";
import MatikaTabs from "./MatikaTabs";

/**
 * A section landing page's head (/entertainment-news, /life-style): the
 * section's own ព្រឹត្តិការណ៍ប្រចាំថ្ងៃ feed, then the two global news columns,
 * then the មាតិការសនិយម strip. Everything below this is LandingTail.
 *
 * The lead grid is the homepage's own DailyEventsSection, pager and all — the
 * only difference is which feed it walks: this section's articles rather than
 * the news root. `basePath` is the section's own URL, so its pager links to
 * /entertainment-news?page=2 rather than the homepage's.
 */
export default function SectionHead({
  section,
  matika,
  basePath,
}: {
  section: NonNullable<LandingFeed["section"]>;
  matika: LandingFeed["matika"];
  /** This landing page's path, e.g. "/entertainment-news". */
  basePath: string;
}) {
  return (
    <>
      <DailyEventsSection cards={section.daily.cards} page={section.daily.page} totalPages={section.daily.totalPages} basePath={basePath} />

      <div
        className={cx(
          container,
          css({
            marginTop: "44px",
            display: "grid",
            gridTemplateColumns: { base: "1fr", lg: "460px 1fr" },
            gap: "30px",
            alignItems: "start",
          }),
        )}
      >
        {/* ព័ត៌មានពេញនិយម is a uniform stack of image-on-top cards; របាយការណ៍ថ្មីៗ
            leads with a large card and then runs image-left rows. */}
        <CardColumn block={section.topNews} sizes="(max-width: 1024px) 100vw, 460px" />
        <LeadAndRows block={section.reports} sizes="(max-width: 1024px) 100vw, 620px" />
      </div>

      <div className={cx(container, css({ marginTop: "44px" }))}>
        <MatikaTabs heading={matika.heading} tabs={matika.tabs} />
      </div>
    </>
  );
}
