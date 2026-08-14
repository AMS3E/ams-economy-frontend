import { css, cx } from "@/styled-system/css";
import { container } from "@/components/layout/shared";
import { CardRow, Thumbs } from "@/components/landing/blocks";
import type { ArticleRef } from "@/lib/articles";

/** Section — "អចលនទ្រព្យ" and "ជំនួញ" (two stacked three-up card rows) beside
 *  "ហិរញ្ញវត្ថុ" (a thumbnail list): the remaining NAV_SECTIONS terms (see
 *  categories.ts) not already covered by BusinessInnovationSection. */
export default function RealEstateFinanceSection({
  realestate,
  business,
  finance,
}: {
  realestate: ArticleRef[];
  business: ArticleRef[];
  finance: ArticleRef[];
}) {
  if (!realestate.length && !business.length && !finance.length) return null;

  return (
    <div
      className={cx(
        container,
        css({
          marginTop: "44px",
          display: "grid",
          gridTemplateColumns: { base: "1fr", lg: "minmax(0,1fr) 420px" },
          gap: "44px 34px",
          alignItems: "start",
        }),
      )}
    >
      <div className={css({ display: "flex", flexDirection: "column", gap: "44px" })}>
        <CardRow block={{ heading: "អចលនទ្រព្យ", href: "/real-estate", items: realestate }} big />
        <CardRow block={{ heading: "ជំនួញ", href: "/business", items: business }} big />
      </div>
      <Thumbs block={{ heading: "ហិរញ្ញវត្ថុ", href: "/finance", items: finance }} detailed variant="line" />
    </div>
  );
}
