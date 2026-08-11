import Link from "next/link";
import { css } from "@/styled-system/css";
import CoverImage from "@/components/ui/CoverImage";
import CategoryLinks from "@/components/ui/CategoryLinks";
import SectionHeader from "@/components/ui/SectionHeader";
import RankedList from "@/components/ui/RankedList";
import type { ArticleRef, NamedList, PopularItem } from "@/lib/articles";
import AdEmbed from "../ui/AdEmbed";
import { kbPrasacPortrait } from "@/lib/promos";

/** Category widget: vertical list of image-topped cards. The meta line sits
 *  outside the article link so its category link doesn't nest inside it. */
function CardList({ items }: { items: ArticleRef[] }) {
  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "18px" })}>
      {items.map((item) => {
        const cat = item.categories?.[0];
        return (
          <div key={item.slug}>
            <Link
              href={`/article/${item.slug}`}
              className={css({
                display: "block",
                color: "inherit",
                textDecoration: "none",
                _hover: { "& .cl-t": { color: "brand.blue" }, "& img": { transform: "scale(1.05)" } },
              })}
            >
              <div
                className={css({
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16/9",
                  overflow: "hidden",
                  "& img": { transition: "transform .45s ease" },
                })}
              >
                <CoverImage src={item.image} sizes="320px" />
              </div>
              <div className={`cl-t ${css({ fontSize: "13.5px", fontWeight: 600, color: "text", marginTop: "9px", lineHeight: 1.5, transition: "color .2s" })}`}>{item.title}</div>
            </Link>
            {(cat || item.date) && (
              <div className={css({ fontSize: "11px", color: "muted", marginTop: "5px" })}>
                {cat && <CategoryLinks cats={[cat]} />}
                {cat && item.date && " · "}
                {item.date}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Sidebar({ popular, sidebarLists, emptyWidget }: { popular: PopularItem[]; sidebarLists: NamedList[]; emptyWidget: string }) {
  const [first, second, third] = sidebarLists;
  return (
    <aside
      className={css({
        position: { lg: "sticky" },
        top: "16px",
        alignSelf: "start",
        display: "flex",
        flexDirection: "column",
        gap: "40px",
      })}
    >
      <div>
        <SectionHeader variant="underline" title="ប្រធានបទពេញនិយម" titleSize="22px" />
        <RankedList items={popular} />
        <div
          className={css({
            marginTop: "33px",
          })}
        >
          <AdEmbed promo={kbPrasacPortrait} />
        </div>
      </div>

      {[first, second].filter(Boolean).map((list) => (
        <div key={list.heading}>
          <SectionHeader variant="underline" title={list.heading} titleSize="22px" seeAllHref={list.href} />
          <CardList items={list.items} />
        </div>
      ))}

      {/* Empty widget — matches the live site's "No posts found" */}
      <div>
        <SectionHeader variant="underline" title={emptyWidget} />
        <div className={css({ fontSize: "13px", color: "muted", padding: "6px 0" })}>No posts found.</div>
        <div
          className={css({
            marginTop: "33px",
          })}
        >
          <AdEmbed promo={kbPrasacPortrait} />
        </div>
      </div>

      {third && (
        <div>
          <SectionHeader variant="underline" title={third.heading} seeAllHref={third.href} />
          <CardList items={third.items} />
        </div>
      )}
    </aside>
  );
}
