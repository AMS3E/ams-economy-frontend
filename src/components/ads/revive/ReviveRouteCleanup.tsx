"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const REVIVE_SELECTOR = [
  '[data-revive-zoneid]',
  'iframe[src*="ads.amscloud.cc"]',
  'img[src*="ads.amscloud.cc"]',
  '[id^="beacon_"]',
  '[id^="revive-"]',
  '[class*="revive"]',
].join(",");

function removeReviveArtifacts() {
  // A real slot on the NEW route owns its creative. Cleanup is only for routes
  // with no ads, after the previous route's slot has unmounted.
  if (document.querySelector("[data-revive-zoneid]")) return;

  document.querySelectorAll<HTMLElement>(REVIVE_SELECTOR).forEach(node => {
    // Revive rich-media creatives commonly wrap their iframe/beacon in a body
    // child. Remove that wrapper as one unit, without ever touching the app root.
    let artifact: HTMLElement = node;
    while (artifact.parentElement && artifact.parentElement !== document.body) {
      artifact = artifact.parentElement;
    }
    if (artifact.parentElement === document.body && artifact.tagName !== "SCRIPT") artifact.remove();
    else node.remove();
  });

  const siteRoot = document.querySelector("main")?.parentElement;
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement) || child === siteRoot || child.tagName === "SCRIPT") continue;
    const position = window.getComputedStyle(child).position;
    // Some Revive floating creatives carry no revive/host marker at all after
    // their bootstrap script rewrites them. A fixed/sticky body sibling with
    // visual media is the remaining signature (and is exactly the overlay that
    // survived over the Khmer Insider About block).
    if ((position === "fixed" || position === "sticky") && child.querySelector("img, iframe, canvas, svg")) {
      child.remove();
    }
  }
}

/** Cleans rich-media ads that Revive appends outside React's route subtree.
 * The public layout survives client navigation, so it is the correct lifecycle
 * owner: each pathname change runs after the new route commits. */
export default function ReviveRouteCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    if (document.querySelector("[data-revive-zoneid]")) return;

    removeReviveArtifacts();
    const frame = requestAnimationFrame(removeReviveArtifacts);
    const timers = [250, 1000, 3000].map(delay => window.setTimeout(removeReviveArtifacts, delay));
    const observer = new MutationObserver(removeReviveArtifacts);
    observer.observe(document.body, { childList: true });

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(window.clearTimeout);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
