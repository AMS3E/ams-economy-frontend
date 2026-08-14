import { css, cx } from "@/styled-system/css";
import { container } from "@/components/layout/shared";
import { CardRow } from "@/components/landing/blocks";
import { categoryRefs } from "@/lib/articles";

/** Latest commercial articles from Economy's PR category. */
export default async function CommercialArticlesSection() {
  const articles = await categoryRefs("news-pr", 3);
  if (!articles.length) return null;

  return (
    <div className={cx(container, css({ marginTop: "44px" }))}>
      <CardRow
        block={{
          heading: "អត្ថបទពាណិជ្ជកម្ម",
          href: "/pr",
          items: articles,
        }}
        big
      />
    </div>
  );
}
