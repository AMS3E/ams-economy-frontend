import Link from "next/link";
import { css, cx } from "@/styled-system/css";
import CoverImage from "@/components/ui/CoverImage";
import CategoryLinks from "@/components/ui/CategoryLinks";
import SectionHeader from "@/components/ui/SectionHeader";
import { container } from "@/components/layout/shared";
import type { HomeCard } from "@/lib/home-data";
import { articleHref, cardLink, cardTag, thumb16x11 } from "./styles";

/** Section 2 — "របាយការណ៍ថ្មីៗ": a 4-column grid of latest reports. */
export default function LatestReportsSection({ items }: { items: HomeCard[] }) {
  // Nothing to show: drop the whole section rather than render a heading over
  // an empty row. Its data is fetched with a `catch -> []`, so this is also
  // how a failed read leaves the page — fewer real blocks, never faked ones.
  if (!items.length) return null;

  return (
    <div className={cx(container)}>
      <SectionHeader title='របាយការណ៍ថ្មីៗ' seeAllHref='/category/reports' />
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: { base: "repeat(2,1fr)", md: "repeat(4,1fr)" },
          gap: "1.5rem",
        })}>
        {items.map((d, i) => (
          // Meta lines sit outside the article link so the category links
          // don't nest inside another anchor.
          <div key={i} className={css({ display: "flex", flexDirection: "column" })}>
            <Link href={articleHref(d.slug)} className={cardLink}>
              <div className={thumb16x11}>
                <CoverImage src={d.src} sizes='(max-width: 768px) 50vw, 300px' />
              </div>
              <div
                className={css({
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "text",
                  marginTop: "9px",
                  lineHeight: 1.5,
                })}>
                {d.title}
              </div>
            </Link>
            {/* Categories and date share one meta line — "cat, cat, cat • date".
                The bullet only renders when there are categories in front of it. */}
            <div className={cardTag}>
              <CategoryLinks cats={d.tags ?? []} />
              {d.date && (
                <span>
                  {d.tags && d.tags.length > 0 ? " • " : ""}
                  {d.date}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
