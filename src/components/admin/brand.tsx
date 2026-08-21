import { css, cx } from "@/styled-system/css";
import { ac } from "./tokens";

// The admin shell's brand lockup, in one place. The sidebar and the sign-in card
// both draw it, so there is one component and no chance of the two drifting.

/** The official "AMS" lettermark: blue → red gradient, same asset the public
 *  site's header/footer use, on the CDN's `economy` bucket. It renders ONLY
 *  "AMS" — no site name baked in — which is why `BrandLockup` below still sets
 *  "ECONOMY" beside it as live text. SVG, and a single asset for BOTH admin
 *  themes: the gradient is mid-toned enough to hold its own on cream and on the
 *  warm near-black. */
export const BRAND_MARK = "https://s3.ams.com.kh/economy/2022/09/AMS-COLOUR-FULL-H28.svg";

/** Rendered size of the mark, holding the artwork's real 79×28 viewBox. Passed
 *  as width/height so the browser reserves the box before the SVG loads and the
 *  nav below never jumps. */
export const BRAND_MARK_W = 79;
export const BRAND_MARK_H = 28;

/** The AMS Economy lockup: the mark, with the site name set beside it.
 *
 *  The site name is TEXT rather than part of the artwork. That is what lets it
 *  recolour per theme — a baked-in black wordmark disappears on the dark rail,
 *  which is exactly the trap the previous PNG lockup fell into and needed a
 *  second file to escape.
 *
 *  Pass `className` to position it. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cx(css({ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }), className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset at icon size */}
      <img
        src={BRAND_MARK}
        alt=""
        width={BRAND_MARK_W}
        height={BRAND_MARK_H}
        className={css({ flex: "none", display: "block" })}
      />
      {/* Tracked out so it reads as a deliberate lockup rather than a caption
          tacked on next to the mark. */}
      <span
        className={css({ fontSize: "11px", fontWeight: 600, letterSpacing: "0.145em", textTransform: "uppercase" })}
        style={{ color: ac.faint }}
      >
        Economy
      </span>
    </span>
  );
}
