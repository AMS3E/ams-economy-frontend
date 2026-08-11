"use client";

import { useRef } from "react";
import Link from "next/link";
import { css, cx } from "@/styled-system/css";
import CoverImage from "@/components/ui/CoverImage";

export interface PosterItem {
  src: string;
  title: string;
  /** Small line above the title — a year on the poster band, an episode number
   *  ("S1:E44") on a program page's episode carousel. */
  year?: string;
  /** When set, the whole card links here. */
  href?: string;
  /** The card the viewer is currently on (the episode being watched) — draws a
   *  highlight outline. Used by the episode page's season browser. */
  active?: boolean;
}

/** The left rail of the "aside" layout. Supplying it moves the arrows out of the
 *  track and into the rail, beneath the heading. */
export interface CarouselAside {
  title: string;
  subtitle?: string;
  seeAllHref?: string;
}

const arrowBase = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "transform .2s",
  _hover: { transform: "scale(1.1)" },
} as const;

/** Overlay arrows: floated over the track's edges, on a dark band. */
const arrow = css({
  ...arrowBase,
  position: "absolute",
  top: "42%",
  background: "control.bg",
  color: "control.fg",
  boxShadow: "0 2px 10px rgba(0,0,0,.4)",
});

/** Rail arrows: sitting in the aside column, so they need no fill of their own. */
const railArrow = css({
  ...arrowBase,
  border: "1px solid",
  borderColor: "divider",
  color: "muted",
  fontSize: "18px",
});

const card = css({ display: "block", flex: "0 0 224px", color: "inherit", textDecoration: "none" });

const poster = css({
  position: "relative",
  width: "100%",
  aspectRatio: "2/3",
  overflow: "hidden",
  cursor: "pointer",
  "& img": { transition: "transform .45s ease" },
  _hover: { "& img": { transform: "scale(1.06)" } },
});

const posterCurrent = css({ outline: "2px solid token(colors.brand.blue)", outlineOffset: "2px" });

const meta = css({ marginTop: "10px" });
const yearText = css({ color: "muted", fontSize: "11px" });
const titleText = css({ color: "text", fontSize: "12.5px", fontWeight: 600, marginTop: "3px" });

export default function PosterCarousel({ posters, aside }: { posters: PosterItem[]; aside?: CarouselAside }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (delta: number) => trackRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  const track = (
    <div
      ref={trackRef}
      className={css({
        display: "flex",
        gap: "16px",
        overflowX: "auto",
        scrollBehavior: "smooth",
        padding: "4px 0",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      })}>
      {posters.map((p, i) => {
        const body = (
          <>
            <div className={cx(poster, p.active && posterCurrent)}>
              <CoverImage src={p.src} sizes='224px' />
            </div>
            <div className={meta}>
              {p.year && <div className={yearText}>{p.year}</div>}
              <div className={titleText}>{p.title}</div>
            </div>
          </>
        );

        return p.href ? (
          <Link key={i} href={p.href} className={card}>
            {body}
          </Link>
        ) : (
          <div key={i} className={card}>
            {body}
          </div>
        );
      })}
    </div>
  );

  // Aside layout: heading, blurb, arrows and "see all" stacked in a left rail,
  // with the track running alongside. Used by the landing pages' សម្រាប់លោកអ្នក.
  if (aside) {
    return (
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: { base: "1fr", lg: "300px minmax(0,1fr)" },
          gap: "30px",
          alignItems: "start",
        })}>
        <div>
          <h2 className={css({ fontSize: "28px", fontWeight: 600, color: "text", lineHeight: 1.4 })}>{aside.title}</h2>
          {aside.subtitle && (
            <p className={css({ fontSize: "13px", color: "muted", marginTop: "10px" })}>{aside.subtitle}</p>
          )}
          <div className={css({ display: "flex", gap: "12px", marginTop: "22px" })}>
            <span onClick={() => scroll(-440)} role='button' aria-label='Previous' className={railArrow}>
              ‹
            </span>
            <span onClick={() => scroll(440)} role='button' aria-label='Next' className={railArrow}>
              ›
            </span>
          </div>
          {aside.seeAllHref && (
            <Link
              href={aside.seeAllHref}
              className={css({
                display: "inline-block",
                marginTop: "22px",
                fontSize: "14px",
                color: "muted",
                textDecoration: "none",
                transition: "opacity .2s",
                _hover: { opacity: 0.7 },
              })}>
              មើលទាំងអស់ ›
            </Link>
          )}
        </div>
        {track}
      </div>
    );
  }

  return (
    <div className={css({ position: "relative" })}>
      {track}

      <span onClick={() => scroll(-440)} role='button' aria-label='Previous' className={cx(arrow, css({ left: "-12px" }))}>
        ‹
      </span>
      <span onClick={() => scroll(440)} role='button' aria-label='Next' className={cx(arrow, css({ right: "-12px" }))}>
        ›
      </span>
    </div>
  );
}
