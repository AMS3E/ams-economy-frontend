"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { css } from "@/styled-system/css";
import type { Video } from "@/lib/api/video";

const playButton = css({
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%,-50%)",
  width: "84px",
  height: "84px",
  borderRadius: "50%",
  background: "rgba(255,255,255,.92)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 4px 24px rgba(0,0,0,.4)",
  transition: "transform .2s",
  textDecoration: "none",
  border: "none",
  _hover: { transform: "translate(-50%,-50%) scale(1.08)" },
});

const playGlyph = css({ color: "#15161d", fontSize: "30px", marginLeft: "5px" });

/** The ▶ button on the feature strip. With a trailer it opens a lightbox (the
 *  live site's fancybox behaviour); with none it NAVIGATES to `watchHref` — the
 *  show's newest episode — which is what live's own player template does. Only
 *  when it has neither does it render nothing.
 *
 *  The iframe is only mounted while the lightbox is open, so the banner costs
 *  nothing on a page nobody clicks it on. */
export default function FeatureTrailer({
  video,
  title,
  watchHref,
}: {
  video: Video | null;
  title: string;
  watchHref?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    // The page behind a lightbox must not scroll.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!video) {
    if (!watchHref) return null;
    return (
      <Link href={watchHref} aria-label={`Watch ${title}`} className={playButton}>
        <span className={playGlyph}>▶</span>
      </Link>
    );
  }

  return (
    <>
      <button
        type='button'
        aria-label={`Play the ${title} trailer`}
        onClick={() => setOpen(true)}
        className={playButton}>
        <span className={playGlyph}>▶</span>
      </button>

      {open && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label={`${title} trailer`}
          onClick={() => setOpen(false)}
          className={css({
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          })}>
          <div
            // The backdrop closes on click; the player itself must not.
            onClick={e => e.stopPropagation()}
            className={css({
              position: "relative",
              width: "100%",
              maxWidth: "960px",
              aspectRatio: "16 / 9",
              background: "#000",
            })}>
            {/* Vimeo and YouTube are both an iframe over a `src` — toVideo always
                emits a query string on both, so `&autoplay=1` appends cleanly. */}
            {(video.kind === "vimeo" || video.kind === "youtube") && (
              <iframe
                src={`${video.src}&autoplay=1`}
                title={`${title} trailer`}
                allow='autoplay; fullscreen; picture-in-picture'
                allowFullScreen
                className={css({ width: "100%", height: "100%", border: 0 })}
              />
            )}
            {video.kind === "file" && (
              <video src={video.url} controls autoPlay className={css({ width: "100%", height: "100%" })} />
            )}
            {/* An editor-pasted embed. Trusted: it comes from our own WP admin. */}
            {video.kind === "embed" && (
              <div
                dangerouslySetInnerHTML={{ __html: video.html }}
                className={css({ width: "100%", height: "100%", "& iframe": { width: "100%", height: "100%" } })}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
