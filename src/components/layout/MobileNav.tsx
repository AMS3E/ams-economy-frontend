"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { css } from "@/styled-system/css";
import { ChevronDownIcon, CloseIcon, MenuIcon, SearchIcon, SmartphoneIcon } from "@/components/icons";
import type { NavSection } from "@/lib/categories";
import { PROGRAM_ICON_LABEL, type NavPill, type ProgramIcon } from "@/lib/navigation";
import { programHref } from "@/lib/programs";

// The whole desktop header (SiteHeader) is a Server Component that opens its
// menus on hover with no JS. That approach can't drive a mobile drawer — a drawer
// needs open/close state and per-section accordions — so this one client
// component owns the hamburger AND the drawer, and is fed the SAME server data
// (menu, pills, program icons) SiteHeader already fetches. Desktop and mobile
// therefore render one source of truth and cannot drift.
//
// Everything below the drawer's search box is a vertical fold of the desktop
// header: the two category sections (kept at their full section -> topic ->
// {news, reports} depth, as nested accordions), the digital-content strip folded
// into one collapsible group, and the colored program pills stacked flat.

type Props = { menu: NavSection[]; pills: NavPill[]; progIcons: ProgramIcon[] };

// The drawer hangs off the always-dark header, so — like the desktop panels —
// these colors are literal, not themed tokens: a themed surface here would go
// white on a black bar half the time.
const HAIRLINE = "rgba(255,255,255,.08)";

// Shown only below `lg`; on desktop the hover nav in SiteHeader takes over.
const hamburger = css({
  display: { base: "inline-flex", lg: "none" },
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  color: "#e4e5ea",
  cursor: "pointer",
  transition: "color .2s",
  _hover: { color: "#fff" },
});

// The overlay is gated off entirely on desktop, so a mobile→desktop resize while
// open can't leave it stranded on screen. Within `base` the open state is driven
// by data-open (an attribute selector, not a second `transform`/`opacity` class —
// two competing atomic classes would resolve by stylesheet order, not intent).
const overlay = css({
  display: { base: "block", lg: "none" },
  position: "fixed",
  inset: 0,
  zIndex: 100,
  visibility: "hidden",
  transition: "visibility .3s",
  "&[data-open='true']": { visibility: "visible" },
});

const backdrop = css({
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,.55)",
  opacity: 0,
  transition: "opacity .3s",
  "&[data-open='true']": { opacity: 1 },
});

const panel = css({
  position: "absolute",
  insetBlock: 0,
  left: 0,
  width: "min(88%, 380px)",
  display: "flex",
  flexDirection: "column",
  background: "#0a0b0f",
  transform: "translateX(-100%)",
  transition: "transform .3s ease",
  overflowY: "auto",
  overscrollBehavior: "contain",
  "&[data-open='true']": { transform: "translateX(0)" },
});

const drawerHead = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  px: "20px",
  py: "16px",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: HAIRLINE,
});

const closeBtn = css({
  display: "inline-flex",
  flex: "0 0 auto",
  color: "#9a9ba3",
  cursor: "pointer",
  transition: "color .2s",
  _hover: { color: "#fff" },
});

const searchWrap = css({ position: "relative", px: "20px", py: "16px" });

const searchInput = css({
  width: "100%",
  height: "42px",
  pl: "16px",
  pr: "42px",
  color: "#e4e5ea",
  fontSize: "15px",
  background: "transparent",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,.18)",
  borderRadius: "4px",
  outline: "none",
  _placeholder: { color: "#7c7d86" },
  _focus: { borderColor: "rgba(255,255,255,.4)" },
});

const searchGlyph = css({
  position: "absolute",
  right: "34px",
  top: "50%",
  transform: "translateY(-50%)",
  color: "#7c7d86",
  pointerEvents: "none",
});

const group = css({ borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: HAIRLINE });

// One row = a Link (navigates to the landing page, as the desktop label does) plus
// a separate chevron button (toggles the accordion). Splitting them keeps the
// landing link reachable without a tap on the row hijacking the expand.
const rowLink = css({
  flex: "1",
  minWidth: 0,
  py: "14px",
  color: "#e4e5ea",
  fontSize: "15px",
  fontWeight: 500,
  transition: "color .15s",
  _hover: { color: "#fff" },
});

const rowToggle = css({
  display: "inline-flex",
  alignItems: "center",
  flex: "0 0 auto",
  alignSelf: "stretch",
  pl: "14px",
  color: "#9a9ba3",
  cursor: "pointer",
  transition: "color .15s",
  _hover: { color: "#fff" },
});

const chevron = css({ transition: "transform .2s", flex: "0 0 auto" });

const rowHeadBase = { display: "flex", alignItems: "center" } as const;
const sectionHead = css({ ...rowHeadBase, px: "20px" });
const topicHead = css({ ...rowHeadBase, pl: "32px", pr: "20px" });

// Nested levels sit on progressively lighter surfaces and step further in, so the
// depth reads at a glance.
const subList = css({ background: "#0e0f15" });
const leafWrap = css({ background: "#121319" });
const leafLink = css({
  display: "block",
  pl: "44px",
  pr: "20px",
  py: "11px",
  color: "#9a9ba3",
  fontSize: "14px",
  transition: "color .15s",
  _hover: { color: "#fff" },
});

const digitalBtn = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  px: "20px",
  py: "14px",
  color: "#e4e5ea",
  fontSize: "15px",
  fontWeight: 500,
  cursor: "pointer",
  transition: "color .15s",
  _hover: { color: "#fff" },
});

const pillList = css({ display: "flex", flexDirection: "column", py: "8px" });
const pill = css({
  display: "block",
  px: "20px",
  py: "13px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: 600,
  transition: "filter .2s",
  _hover: { filter: "brightness(1.1)" },
});

const footer = css({ mt: "auto", px: "20px", py: "20px", color: "#7c7d86", fontSize: "13px", fontStyle: "italic" });

export default function MobileNav({ menu, pills, progIcons }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const isOpen = (key: string) => expanded.has(key);
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const closeDrawer = () => {
    setOpen(false);
    hamburgerRef.current?.focus();
  };

  // While open: lock body scroll, move focus into the drawer, and let Escape
  // close it. All of it unwinds when `open` flips back to false.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const spin = (on: boolean) => ({ transform: on ? "rotate(180deg)" : "rotate(0deg)" });

  return (
    <>
      <button
        ref={hamburgerRef}
        type="button"
        aria-label="បើកម៉ឺនុយ"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={hamburger}>
        <MenuIcon size={24} />
      </button>

      <div className={overlay} data-open={open} aria-hidden={!open}>
        <div className={backdrop} data-open={open} onClick={closeDrawer} />

        <aside className={panel} data-open={open} role="dialog" aria-modal="true" aria-label="ម៉ឺនុយ">
          <div className={drawerHead}>
            {/* Same brand mark as the desktop bar. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://s3.ams.com.kh/infotainment/2022/09/AMS-COLOUR-FULL-H28.svg" width={79} height={28} alt="AMS Infotainment" />
            <button ref={closeRef} type="button" aria-label="បិទម៉ឺនុយ" onClick={closeDrawer} className={closeBtn}>
              <CloseIcon size={24} />
            </button>
          </div>

          {/* Visual only for now — mirrors the desktop search, which is not wired yet. */}
          <div className={searchWrap}>
            <input className={searchInput} type="search" placeholder="ស្វែងរក…" aria-label="ស្វែងរក" />
            <SearchIcon size={18} className={searchGlyph} />
          </div>

          <nav aria-label="ប្រភេទអត្ថបទ">
            {menu.map((section) => (
              <div key={section.href} className={group}>
                <div className={sectionHead}>
                  <Link href={section.href} onClick={closeDrawer} className={rowLink}>
                    {section.label}
                  </Link>
                  <button
                    type="button"
                    aria-expanded={isOpen(section.href)}
                    aria-label={`${isOpen(section.href) ? "បិទ" : "បើក"} ${section.label}`}
                    onClick={() => toggle(section.href)}
                    className={rowToggle}>
                    <ChevronDownIcon size={20} className={chevron} style={spin(isOpen(section.href))} />
                  </button>
                </div>

                {isOpen(section.href) && (
                  <div className={subList}>
                    {section.topics.map((topic) => (
                      <div key={topic.href}>
                        <div className={topicHead}>
                          <Link href={topic.href} onClick={closeDrawer} className={rowLink}>
                            {topic.label}
                          </Link>
                          <button
                            type="button"
                            aria-expanded={isOpen(topic.href)}
                            aria-label={`${isOpen(topic.href) ? "បិទ" : "បើក"} ${topic.label}`}
                            onClick={() => toggle(topic.href)}
                            className={rowToggle}>
                            <ChevronDownIcon size={20} className={chevron} style={spin(isOpen(topic.href))} />
                          </button>
                        </div>

                        {isOpen(topic.href) && (
                          <div className={leafWrap}>
                            {topic.leaves.map((leaf) => (
                              <Link key={leaf.href} href={leaf.href} onClick={closeDrawer} className={leafLink}>
                                {leaf.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* The digital-content strip, folded into one accordion. No landing
                page stands behind the group, so its header is a plain toggle. */}
            <div className={group}>
              <button type="button" aria-expanded={isOpen("digital")} onClick={() => toggle("digital")} className={digitalBtn}>
                <SmartphoneIcon size={18} className={css({ flex: "0 0 auto" })} />
                <span className={css({ flex: "1", textAlign: "start" })}>{PROGRAM_ICON_LABEL.replace(/:$/, "")}</span>
                <ChevronDownIcon size={20} className={chevron} style={spin(isOpen("digital"))} />
              </button>

              {isOpen("digital") && (
                <div className={subList}>
                  {progIcons.map((p) => (
                    <Link key={p.slug} href={programHref(p.slug)} onClick={closeDrawer} className={leafLink}>
                      {p.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className={pillList}>
            {pills.map((p) => (
              <Link key={p.slug} href={programHref(p.slug)} onClick={closeDrawer} className={pill} style={{ background: p.background }}>
                {p.label}
              </Link>
            ))}
          </div>

          <div className={footer}>@infotainment</div>
        </aside>
      </div>
    </>
  );
}
