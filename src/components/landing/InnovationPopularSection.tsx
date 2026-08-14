import { css, cx } from "@/styled-system/css";
import { container } from "@/components/layout/shared";
import { LeadBesideRows, Ranked } from "@/components/landing/blocks";
import { categoryRefs, categoryRefsByIds } from "@/lib/articles";

/** Startup/innovation lead stories beside the curated popular ranking. */
export default async function InnovationPopularSection() {
  const [innovation, popular] = await Promise.all([
    categoryRefs("news-startup-and-innovation", 4),
    categoryRefsByIds("243", 7),
  ]);

  if (!innovation.length && !popular.length) return null;

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
      <LeadBesideRows
        block={{
          heading: "អាជីវកម្មថ្មី និងនវានុវត្ត",
          href: "/start-up-innovation",
          items: innovation,
        }}
        sizes="(max-width: 768px) 100vw, 500px"
        detailed
      />
      <Ranked
        block={{
          heading: "ប្រធានបទពេញនិយម",
          href: "/category/all-news",
          items: popular.map((article) => ({ slug: article.slug, title: article.title })),
        }}
        variant="line"
      />
    </div>
  );
}
