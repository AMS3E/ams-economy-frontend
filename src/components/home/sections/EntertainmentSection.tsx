import { css, cx } from "@/styled-system/css";
import { container } from "@/components/layout/shared";
import { CardRow } from "@/components/landing/blocks";
import type { ArticleRef } from "@/lib/articles";

/** Section — "អត្ថបទកម្សាន្ត": a three-up card row. Economy's taxonomy has no
 *  entertainment-news term (that's Infotainment's — see categories.ts), so this
 *  runs on top-news (/category/all-news/top-news), the closest real analog. */
export default function EntertainmentSection({ items }: { items: ArticleRef[] }) {
  if (!items.length) return null;

  return (
    <div className={cx(container, css({ marginTop: "44px" }))}>
      <CardRow block={{ heading: "អត្ថបទកម្សាន្ត", href: "/category/all-news/top-news", items }} />
    </div>
  );
}
