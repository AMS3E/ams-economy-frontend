import { css, cx } from "@/styled-system/css";
import { SITE_ICON_URL } from "@/lib/site";
import { ac } from "./tokens";

// The admin shell's brand lockup, in one place. The sidebar and the sign-in card
// both draw it, so there is one component and no chance of the two drifting.

/** The official square AMS Economy mark, shared with the public header and
 *  browser favicon. The site name remains live text beside it. */
export const BRAND_MARK = SITE_ICON_URL;

/** Rendered size reserves the square before the remote image loads. */
export const BRAND_MARK_W = 40;
export const BRAND_MARK_H = 40;

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
    <span className={cx(css({ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }), className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset at icon size */}
      <img
        src={BRAND_MARK}
        alt=""
        width={BRAND_MARK_W}
        height={BRAND_MARK_H}
        className={css({ borderRadius: "9px", flex: "none", display: "block" })}
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
