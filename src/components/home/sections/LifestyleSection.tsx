import Link from "next/link";
import { css, cx } from "@/styled-system/css";
import AdEmbed from "@/components/ui/AdEmbed";
import CoverImage from "@/components/ui/CoverImage";
import SectionHeader from "@/components/ui/SectionHeader";
import { container } from "@/components/layout/shared";
import type { HomeCard } from "@/lib/home-data";
import { kbPrasacFullLandscape, kbPrasacLandscapeShort } from "@/lib/promos";
import { articleHref, cardLink, cardTag, cardTitle, thumb16x11 } from "./styles";

/** Section 3 — "រសនិយម" lifestyle grid on the left, a single promo ad on the right. */
export default function LifestyleSection({ items }: { items: HomeCard[] }) {
  // Nothing to show: drop the whole section rather than render a heading over
  // an empty row. Its data is fetched with a `catch -> []`, so this is also
  // how a failed read leaves the page — fewer real blocks, never faked ones.
  if (!items.length) return null;

  return (
    <div className={cx(container, css({ marginTop: "40px" }))}>
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: { base: "1fr", lg: "1fr 1fr" },
          gap: "1.5rem",
          alignItems: "stretch",
        })}
      >
        {/* left: 3 columns x 2 rows */}
        <div>
          <SectionHeader title="រសនិយម" seeAllHref="/category/life-style/news" />
          <div
            className={css({
              display: "grid",
              gridTemplateColumns: { base: "repeat(2,1fr)", md: "repeat(3,1fr)" },
              gap: "18px",
              alignContent: "start",
            })}
          >
            {/* The meta line is a CATEGORY LINK, not the date — this slot used to
                print `d.date`. It sits outside the card's <Link> because an
                anchor inside an anchor is invalid HTML (see CategoryLinks). */}
            {items.map((d, i) => (
              <div key={i}>
                <Link href={articleHref(d.slug)} className={cardLink}>
                  <div className={thumb16x11}>
                    <CoverImage src={d.src} sizes="(max-width: 768px) 50vw, 260px" />
                  </div>
                  <div className={cardTitle}>{d.title}</div>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* right: single ad block. Column flex, so `justifyContent` centres on
            the vertical axis — AdEmbed sets `align-self: start` on itself, which
            would beat any `alignItems` we set here. */}
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          })}
        >
          <AdEmbed promo={kbPrasacLandscapeShort} />
        </div>
      </div>
      <div className={css({ paddingTop: "56px" })}>
        <AdEmbed promo={kbPrasacFullLandscape} />
      </div>
    </div>
  );
}
