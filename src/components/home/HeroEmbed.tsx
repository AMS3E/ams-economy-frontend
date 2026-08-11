"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { css } from "@/styled-system/css";
// Shared with the article-slider frames (SrEmbed): both forward slide clicks to
// the parent and need the same answer for "is this WP URL one of ours?".
import { mapWpUrl, WP_ORIGIN } from "@/lib/wp-url-map";

/**
 * Embeds a live Slider Revolution hero (authored in WordPress) via an iframe
 * pointing at /hero-embed. `alias` picks a landing page's own slider; omit it
 * for the homepage's (and note the embed serves the homepage slider for ANY
 * alias until the WP plugin is on ≥1.5.0 — the parameter is simply ignored).
 *
 * The embed page posts its height so the iframe sizes responsively. Until that
 * arrives we reserve the hero's space and fill it with a shimmer placeholder,
 * then fade the iframe in — so the page never collapses to a 0px gap and jumps
 * when the slider boots (which is exactly how the hero used to "disappear while
 * loading"). If no height ever arrives (backend down or route removed), a ~10s
 * timeout drops the reservation so a dead slider collapses to nothing rather
 * than shimmering forever.
 * It also forwards slide-link CLICKS as postMessage: every anchor in the
 * slider is an absolute WordPress URL, and before this the hero was a trapdoor
 * out of the app (AUDIT.md Tier 2 §14).
 */
// Shown over the reserved band until the slider reports its height — the same
// shimmer CoverImage uses, so the hero reads as "loading" rather than blank.
const placeholder = css({
  position: "absolute",
  inset: 0,
  backgroundColor: "skeleton.base",
  backgroundImage:
    "linear-gradient(90deg, token(colors.skeleton.base) 0%, token(colors.skeleton.sheen) 50%, token(colors.skeleton.base) 100%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.4s ease-in-out infinite",
  _motionReduce: { backgroundImage: "none", animation: "none" },
});

export default function HeroEmbed({ alias }: { alias?: string }) {
  const [height, setHeight] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== WP_ORIGIN) return;
      const data = e.data as { amsHeroHeight?: number; amsHeroNav?: string } | null;

      const h = data?.amsHeroHeight;
      if (typeof h === "number" && h > 0) setHeight(h);

      const nav = data?.amsHeroNav;
      if (typeof nav === "string" && nav) {
        const mapped = mapWpUrl(nav);
        if (mapped) router.push(mapped);
        else window.open(nav, "_blank", "noopener");
      }
    }
    window.addEventListener("message", onMessage);
    // Stop reserving space if the slider never reports a height, so a dead
    // backend collapses to nothing instead of shimmering forever.
    const timer = setTimeout(() => setGaveUp(true), 10000);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, [router]);

  const src = alias ? `${WP_ORIGIN}/hero-embed?alias=${encodeURIComponent(alias)}` : `${WP_ORIGIN}/hero-embed`;

  const loaded = height > 0;
  const reserving = !loaded && !gaveUp;

  return (
    <div
      className={css({
        position: "relative",
        width: "100%",
        overflow: "hidden",
        // Reserve the hero's space up front so the page never collapses to a
        // 0px gap and then jumps when WordPress finishes booting the slider.
        // Dropped once the real height is known (or we give up), so the band
        // settles to the slider's own size with no leftover gap.
        minHeight: { base: "340px", md: "500px" },
      })}
      style={reserving ? undefined : { minHeight: 0 }}
    >
      {reserving && <div className={placeholder} aria-hidden />}
      <iframe
        src={src}
        title="Featured banners"
        loading="eager"
        className={css({ display: "block", width: "100%", border: "0", transition: "opacity .35s ease" })}
        style={{ height: `${height}px`, opacity: loaded ? 1 : 0 }}
      />
    </div>
  );
}
