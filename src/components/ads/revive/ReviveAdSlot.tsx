"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { css } from "@/styled-system/css";
import type { ReviveZone } from "./zones";

// Same fix as ScaledAdFrame (@/components/ui/ScaledAdFrame), and the same
// reason: the creative doesn't shrink itself. There it's an export rendering
// at a fixed pixel width; here it's Revive's OWN injected markup — its script
// clones our <ins> and either drops in an <iframe> it builds at the zone's
// configured width/height (no responsive sizing at all, confirmed 2026-08-12:
// zone 4's response HTML hardcodes `width: 1920px`) or sets raw innerHTML
// carrying the same fixed-width iframe. Either way `maxWidth: 100%` on the
// <ins> itself did nothing, because the OVERFLOWING element is a child Revive
// injects, not the <ins> we sized — a parent's max-width never constrains a
// child that declares its own explicit width. Caught 2026-08-12: the full
// landscape zone (1920px) broke straight through the page's 1440px container.
//
// The fix: reserve a box at the zone's aspect ratio, sized to 100% of the
// AVAILABLE width (not the raw px value) with `overflow: hidden`, then hold
// the <ins> — and whatever Revive replaces it with — inside an inner box at
// its true native pixel size, scaled down to fit via a CSS transform. The
// transform scales the whole rendered subtree uniformly regardless of what
// Revive puts inside it, so this holds even though (unlike ScaledAdFrame) we
// don't control the injected iframe directly.
const box = css({ position: "relative", width: "100%", mx: "auto", overflow: "hidden" });
const frame = css({ position: "absolute", top: 0, left: 0, transformOrigin: "top left" });

/**
 * One Revive Adserver zone — Revive's own "Asynchronous JS" invocation code,
 * an `<ins>` Revive's script fills in place plus a shared loader script.
 *
 * The loader is given a fixed `id` ("revive-async-js") rather than one keyed
 * to `zone`, so when a page places more than one zone, Next's own
 * dedup-by-`id` rule (next/script) keeps `asyncjs.php` to a single request —
 * one loader script fills every `<ins data-revive-zoneid>` on the page, same
 * as Revive's own multi-zone docs assume.
 *
 * The outer box carries the zone's aspect ratio, so the slot holds its space
 * before the async creative arrives — no layout shift, same intent as
 * AdEmbed's aspect-ratio box for the self-hosted promos.
 */
export default function ReviveAdSlot({ zone }: { zone: ReviveZone }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // setState fires from the observer callback (a subscription), not
    // synchronously in the effect body.
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / zone.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [zone.width]);

  return (
    <div ref={ref} className={box} style={{ maxWidth: `${zone.width}px`, aspectRatio: `${zone.width} / ${zone.height}` }}>
      <div className={frame} style={{ width: zone.width, height: zone.height, transform: `scale(${scale})` }}>
        <ins
          data-revive-zoneid={zone.zoneId}
          data-revive-id={zone.id}
          aria-label={zone.title}
          style={{ display: "block", width: zone.width, height: zone.height }}
        />
      </div>
      <Script id="revive-async-js" async src="//ads.amscloud.cc/www/delivery/asyncjs.php" strategy="afterInteractive" />
    </div>
  );
}
