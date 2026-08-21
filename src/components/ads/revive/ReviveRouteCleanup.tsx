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
  if (document.querySelector("[data-revive-zoneid]")) return;

  document.querySelectorAll<HTMLElement>(REVIVE_SELECTOR).forEach(node => {
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
    if ((position === "fixed" || position === "sticky") && child.querySelector("img, iframe, canvas, svg")) {
      child.remove();
    }
  }
}

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
