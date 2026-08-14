import { css, cx } from "@/styled-system/css";
import ReviveAdSlot from "@/components/ads/revive/ReviveAdSlot";
import { reviveHalfLandscape } from "@/components/ads/revive/zones";
import { container } from "@/components/layout/shared";
import { Ranked } from "@/components/landing/blocks";
import { categoryRefs } from "@/lib/articles";

/** Half-landscape campaign beside the nine latest Economy headlines. */
export default async function EconomicAdSection() {
  const articles = await categoryRefs("news-economic", 9);

  return (
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
      <ReviveAdSlot zone={reviveHalfLandscape} />
      <Ranked
        block={{
          heading: "សេដ្ឋកិច្ច",
          href: "/economic",
          items: articles.map((article) => ({ slug: article.slug, title: article.title })),
        }}
        variant="line"
      />
    </div>
  );
}
