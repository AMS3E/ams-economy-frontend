"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { css } from "@/styled-system/css";
import { ac } from "./tokens";
import { Icon } from "./icons";
import { IconButton } from "./ui";
import { logoutAction } from "@/lib/auth/actions";

// The top bar both reference dashboards have and we did not: search, a theme
// control, and the account menu (moved up out of the sidebar's foot, which is
// where it was hiding). It is sticky, because on a long Articles or Media list
// the account menu and the theme control should not require scrolling to the
// top of the page to reach.

interface TopBarUser {
  name: string;
  initials: string;
  roleLabel: string;
}

/* -------------------------------------------------------------------------- *
 * Theme control.
 *
 * This reuses the SITE's existing mechanism rather than adding a second one:
 * the root layout already ships a pre-paint script that reads `ams-theme` from
 * localStorage and stamps `data-theme` on <html>, and the public header's
 * ThemeToggle already writes that key. Two mechanisms would fight over the same
 * attribute. `auto` therefore means what it means on the public site — the
 * visitor's CLOCK, dark from 18:00 to 06:00 — and autoIsDark() below must stay
 * in step with the copy in src/app/layout.tsx.
 * -------------------------------------------------------------------------- */

type Mode = "light" | "dark" | "auto";
const ORDER: Mode[] = ["light", "dark", "auto"];

const autoIsDark = () => {
  const h = new Date().getHours();
  return h >= 18 || h < 6;
};

function applyTheme(mode: Mode) {
  const dark = mode === "auto" ? autoIsDark() : mode === "dark";
  const root = document.documentElement;
  if (dark) root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
}

/* The stored mode is EXTERNAL state — it lives in localStorage, is written by
 * the public site's toggle as well as this one, and is applied before React
 * ever runs by the root layout's pre-paint script. So it is read with
 * useSyncExternalStore rather than mirrored into component state in an effect,
 * which is both what the repo's React-compiler lint requires and the reason it
 * requires it: the effect version renders once with the wrong value and then
 * corrects itself.
 *
 * `storage` only fires in OTHER documents, so same-tab writes notify through
 * our own listener set. */
let listeners: (() => void)[] = [];

function subscribeTheme(cb: () => void) {
  listeners.push(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
    window.removeEventListener("storage", cb);
  };
}

function readMode(): Mode {
  try {
    const v = localStorage.getItem("ams-theme");
    return v === "dark" || v === "auto" ? v : "light";
  } catch {
    return "light";
  }
}

/** The server has no localStorage, and the pre-paint script has not run yet at
 *  render time — so both sides agree on "light" and the script's stamp on
 *  <html> is what actually paints. No hydration mismatch, no flash. */
const serverMode = (): Mode => "light";

function writeMode(mode: Mode) {
  try {
    localStorage.setItem("ams-theme", mode);
  } catch {
    // private mode / storage disabled — the attribute still applies for now
  }
  applyTheme(mode);
  listeners.forEach((l) => l());
}

function ThemeControl() {
  const mode = useSyncExternalStore(subscribeTheme, readMode, serverMode);

  const cycle = () => writeMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]);

  const label =
    mode === "light"
      ? "Theme: light. Switch to dark"
      : mode === "dark"
        ? "Theme: dark. Switch to auto (time of day)"
        : "Theme: auto (dark after 18:00). Switch to light";

  return <IconButton name={mode === "light" ? "sun" : mode === "dark" ? "moon" : "clock"} label={label} onClick={cycle} />;
}

/* -------------------------------------------------------------------------- */

export default function AdminTopBar({ user }: { user: TopBarUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Both listeners are subscriptions, so
  // nothing here sets state synchronously inside the effect body.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header
      className={css({
        position: "sticky",
        top: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        height: "60px",
        padding: "0 24px",
        flex: "none",
      })}
      style={{ background: ac.surface, borderBottom: `1px solid ${ac.border}` }}
    >
      {/* Search. Deliberately scoped to the admin's own screens — the PUBLIC
          site's search is a standing "do not build" decision, and this is not
          it. */}
      <label className={css({ position: "relative", display: "flex", alignItems: "center", flex: "1", maxWidth: "420px" })}>
        <span className={css({ position: "absolute", left: "11px", display: "flex", pointerEvents: "none" })} style={{ color: ac.faint }}>
          <Icon name="search" size={15} strokeWidth={1.9} />
        </span>
        <input
          type="search"
          placeholder="Search articles, media, people…"
          aria-label="Search the dashboard"
          className={css({
            width: "100%",
            height: "36px",
            padding: "0 12px 0 34px",
            borderRadius: "10px",
            fontSize: "13px",
            fontFamily: "inherit",
            color: "var(--colors-admin-text)",
            background: "var(--colors-admin-surface-sunken)",
            border: "1px solid var(--colors-admin-border)",
            transition: "border-color .13s",
            _hover: { borderColor: "var(--colors-admin-border-strong)" },
            _placeholder: { color: "var(--colors-admin-faint)" },
            _focusVisible: { outline: "2px solid var(--colors-admin-focus)", outlineOffset: "2px" },
          })}
        />
      </label>

      <div className={css({ flex: "1" })} />

      <ThemeControl />
      <IconButton name="bell" label="Notifications" />

      {/* Account */}
      <div ref={wrapRef} className={css({ position: "relative", flex: "none" })}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "9px",
            padding: "5px 9px 5px 5px",
            borderRadius: "10px",
            cursor: "pointer",
            border: "1px solid transparent",
            background: "transparent",
            transition: "background .12s, border-color .12s",
            _hover: { background: "var(--colors-admin-surface-hover)", borderColor: "var(--colors-admin-border)" },
            _focusVisible: { outline: "2px solid var(--colors-admin-focus)", outlineOffset: "2px" },
          })}
        >
          <span
            className={css({ width: "30px", height: "30px", borderRadius: "9px", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 700, flex: "none" })}
            style={{ background: ac.accentTint, color: ac.accentText }}
          >
            {user.initials}
          </span>
          <span className={css({ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.25, minWidth: 0 })}>
            <span className={css({ fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap" })}>{user.name}</span>
            <span className={css({ fontSize: "11px" })} style={{ color: ac.muted }}>
              {user.roleLabel}
            </span>
          </span>
          <Icon name="chevronDown" size={14} strokeWidth={2} style={{ color: ac.faint, flex: "none" }} />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className={css({ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "196px", padding: "6px", borderRadius: "12px", zIndex: 40 })}
            style={{ background: ac.surface, border: `1px solid ${ac.border}`, boxShadow: ac.shadowMd }}
          >
            <Link
              href="/admin/profile"
              onClick={() => setMenuOpen(false)}
              className={css({ display: "flex", alignItems: "center", gap: "9px", padding: "9px 10px", borderRadius: "8px", fontSize: "13px", cursor: "pointer", _hover: { background: "var(--colors-admin-surface-hover)" } })}
            >
              <Icon name="users" size={15} strokeWidth={1.7} style={{ color: ac.muted }} />
              My profile
            </Link>
            <div style={{ height: 1, background: ac.border, margin: "5px 0" }} />
            <form action={logoutAction}>
              <button
                type="submit"
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 10px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                  background: "transparent",
                  border: "none",
                  fontFamily: "inherit",
                  _hover: { background: "var(--colors-admin-danger-tint)", color: "var(--colors-admin-danger)" },
                })}
                style={{ color: ac.sub }}
              >
                <Icon name="logout" size={15} strokeWidth={1.7} />
                Log out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
