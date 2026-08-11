import Link from "next/link";
import { css, cx } from "@/styled-system/css";
import ThemeToggle from "./ThemeToggle";
import ProgramIconStrip from "./ProgramIconStrip";
import MobileNav from "./MobileNav";
import { ChevronDownIcon, SearchIcon, UserIcon } from "@/components/icons";
import { getNavPills, getProgramIcons, PROGRAM_ICON_LABEL } from "@/lib/navigation";
import { getNavMenu } from "@/lib/categories";
import { programHref } from "@/lib/programs";
import { container } from "./shared";

// The category menu. It opens on hover and on keyboard focus, so it needs no
// client JS — this component stays a Server Component. (The program-icon strip
// below it is the one exception: it highlights the program you are on, which
// means reading the pathname, which means a hook. See ProgramIconStrip.)
//
// The top bar is painted dark in both themes, so these colors are literal rather
// than tokens; a themed surface here would go white underneath a black bar.
//
// The nav stretches to the bar's full height so a section's hover target is the
// whole 64px, not just its text — which is also what puts the panel's top edge at
// the bar's bottom edge (`top: 100%`) instead of floating in the middle of it.
const navRoot = css({
  display: { base: "none", lg: "flex" },
  alignSelf: "stretch",
  alignItems: "stretch",
  gap: "26px",
});

const navItem = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  "& > .ams-submenu": { display: "none" },
  _hover: { "& > .ams-submenu": { display: "block" } },
  _focusWithin: { "& > .ams-submenu": { display: "block" } },
});

const navTrigger = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  color: "#e4e5ea",
  fontSize: "15px",
  fontWeight: 500,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "color .2s",
  _hover: { color: "#fff" },
});

// White in both themes, like the live menu — it hangs off a bar that is always
// dark, so a themed surface would only ever be right half the time.
const panel = {
  position: "absolute",
  zIndex: 40,
  py: "8px",
  background: "#fff",
  borderRadius: "3px",
  boxShadow: "0 10px 34px rgba(0,0,0,.22)",
} as const;

// The caret is drawn as a bare CSS triangle sitting ON the bar, above the panel's
// own top edge — so the panel needs no border, which a border would have to be
// mitred around.
const submenu = css({
  ...panel,
  top: "100%",
  left: 0,
  minWidth: "234px",
  _before: {
    content: '""',
    position: "absolute",
    top: "-8px",
    left: "22px",
    width: 0,
    height: 0,
    borderLeft: "9px solid transparent",
    borderRight: "9px solid transparent",
    borderBottom: "9px solid #fff",
  },
});

// Opens to the right of its topic row, pulled up by the panel's own padding so
// the first entry lines up with the row that spawned it.
const flyout = css({ ...panel, top: "-9px", left: "100%", minWidth: "196px" });

const topicItem = css({
  position: "relative",
  "& > .ams-flyout": { display: "none" },
  _hover: { "& > .ams-flyout": { display: "block" } },
  _focusWithin: { "& > .ams-flyout": { display: "block" } },
});

const row = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  px: "20px",
  py: "10px",
  color: "#2b2c33",
  fontSize: "15px",
  whiteSpace: "nowrap",
  transition: "background .15s, color .15s",
  _hover: { background: "#f1f2f4", color: "#000" },
});

/** Shared top bar + program-icons row (used on every page via the layout). */
export default async function SiteHeader() {
  const [pills, progIcons, menu] = await Promise.all([getNavPills(), getProgramIcons(), getNavMenu()]);

  return (
    <header>
      {/* ===== TOP BAR ===== */}
      <div className={css({ background: "#0a0b0f", width: "100%" })}>
        <div className={cx(container, css({ height: "64px", display: "flex", alignItems: "center", gap: { base: "14px", lg: "30px" } }))}>
          {/* Hamburger + drawer — mobile only. Fed the same data as the hover nav
              below so the two can never drift. It renders nothing on desktop. */}
          <MobileNav menu={menu} pills={pills} progIcons={progIcons} />
          <Link href="/" className={css({ display: "inline-flex", alignItems: "center", flex: "0 0 auto" })}>
            {/* Official AMS Infotainment brand logo (SVG on the site's CDN). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://s3.ams.com.kh/infotainment/2022/09/AMS-COLOUR-FULL-H28.svg" width={79} height={28} alt="AMS Infotainment" />
          </Link>
          {/* Section -> topic -> {news, reports}. WordPress nests the taxonomy the
              other way round; getNavMenu() transposes it. */}
          <nav className={navRoot} aria-label="ប្រភេទអត្ថបទ">
            {menu.map((section) => (
              <div key={section.href} className={navItem}>
                <Link href={section.href} className={navTrigger}>
                  {section.label}
                  <ChevronDownIcon size={14} className={css({ opacity: 0.7 })} />
                </Link>

                <div className={cx(submenu, "ams-submenu")}>
                  {section.topics.map((topic) => (
                    <div key={topic.href} className={topicItem}>
                      <Link href={topic.href} className={row}>
                        <span>{topic.label}</span>
                        <span className={css({ color: "#9a9ba3" })} aria-hidden>
                          ›
                        </span>
                      </Link>

                      <div className={cx(flyout, "ams-flyout")}>
                        {topic.leaves.map((leaf) => (
                          <Link key={leaf.href} href={leaf.href} className={row}>
                            {leaf.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className={css({ flex: "1" })} />
          {/* skewed colored ribbon */}
          <div
            className={css({
              display: { base: "none", lg: "flex" },
              alignItems: "stretch",
              height: "64px",
            })}
          >
            {pills.map((p) => (
              <Link
                key={p.slug}
                href={programHref(p.slug)}
                className={css({
                  transform: "skewX(-18deg)",
                  marginLeft: "-1px",
                  display: "flex",
                  alignItems: "center",
                  px: "26px",
                  cursor: "pointer",
                  textDecoration: "none",
                  transition: "filter .2s",
                  _hover: { filter: "brightness(1.1)" },
                })}
                style={{ background: p.background }}
              >
                <span
                  className={css({
                    color: "#fff",
                    fontSize: "15px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  })}
                >
                  {p.label}
                </span>
              </Link>
            ))}
          </div>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "18px",
              marginLeft: "18px",
            })}
          >
            <span className={css({ display: "inline-flex", color: "#e4e5ea", cursor: "pointer", _hover: { color: "#fff" } })}>
              <SearchIcon size={20} />
            </span>
            <ThemeToggle />
            <span
              className={css({
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "#d9d9df",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#555",
                cursor: "pointer",
              })}
            >
              <UserIcon size={20} />
            </span>
          </div>
        </div>
      </div>

      {/* ===== PROGRAM ICONS ROW ===== */}
      <div
        className={css({
          background: "#0e0f15",
          width: "100%",
          borderTopWidth: "2px",
          borderTopColor: "#bdc3c7",
          borderTopStyle: "solid",
          boxShadow: "0 4px 2px -2px rgba(0, 0, 0, 0.3)",
        })}
      >
        <div
          className={cx(
            container,
            css({
              height: "64px",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "18px",
              overflowX: "auto",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }),
          )}
        >
          <span
            className={css({
              color: "#9a9ba3",
              fontSize: "17px",
              whiteSpace: "nowrap",
              marginRight: "4px",
            })}
          >
            {PROGRAM_ICON_LABEL}
          </span>
          <ProgramIconStrip icons={progIcons} />
        </div>
      </div>
    </header>
  );
}
