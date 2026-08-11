"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { css } from "@/styled-system/css";
import { ac } from "./tokens";
import { Icon, type IconName } from "./icons";

interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  /** Extra path prefixes that should also light this item (e.g. the editor). */
  also?: string[];
  /** WordPress capability required to see this item; omit for always-on. */
  cap?: string;
}

interface NavGroup {
  /** Section heading. Aurora and Phoenix both group their nav this way, and it
   *  is the cheapest legibility win in the shell: eight flat items read as a
   *  list to scan, three labelled groups read as a place you know. */
  title: string;
  items: NavItem[];
}

// Capability-aware nav. The admin-only items carry the WordPress capability that
// gates them (see ams_afa_login_caps): Users needs list_users, Settings needs
// manage_options. The layout resolves the real session and passes `capabilities`
// down, so an item drops out for anyone who lacks its cap — and a group whose
// every item is filtered out disappears with them.
const GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: "dashboard" }],
  },
  {
    title: "Content",
    items: [
      { label: "Articles", href: "/admin/articles", icon: "articles" },
      { label: "Media", href: "/admin/media", icon: "media" },
      { label: "Programs", href: "/admin/programs", icon: "programs" },
    ],
  },
  {
    title: "Site",
    items: [
      // Menus. The capability WordPress actually enforces on these writes is
      // edit_theme_options, but the login payload only carries the curated
      // allow-list in ams_afa_login_caps(), which does not include it — gating
      // on it here would evaluate to undefined and hide the screen from
      // everyone. manage_options is the closest cap in that list; every real
      // admin has both. Swap the day the plugin's list includes it.
      { label: "Menus", href: "/admin/menus", icon: "list", cap: "manage_options" },
      { label: "Users", href: "/admin/users", icon: "users", cap: "list_users" },
      { label: "Roles", href: "/admin/roles", icon: "eye", cap: "list_users" },
      { label: "Settings", href: "/admin/settings", icon: "settings", cap: "manage_options" },
    ],
  },
];

const navRow = css({
  display: "flex",
  alignItems: "center",
  gap: "11px",
  padding: "8px 11px",
  borderRadius: "9px",
  cursor: "pointer",
  fontSize: "13.5px",
  transition: "background .12s, color .12s",
  _hover: { background: "var(--colors-admin-surface-hover)" },
});

export default function AdminSidebar({ capabilities }: { capabilities: Record<string, boolean> }) {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    // Dashboard is the index, so match it exactly; every other item owns its
    // subtree (so /admin/articles/123 keeps "Articles" lit).
    if (item.href === "/admin") return pathname === "/admin";
    if (pathname === item.href || pathname.startsWith(item.href + "/")) return true;
    return (item.also ?? []).some((p) => pathname.startsWith(p));
  };

  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.cap || capabilities[item.cap] === true),
  })).filter((g) => g.items.length > 0);

  return (
    <aside
      className={css({
        width: "232px",
        flex: "none",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      })}
      style={{ background: ac.surface, borderRight: `1px solid ${ac.border}` }}
    >
      {/* Brand */}
      <div className={css({ display: "flex", alignItems: "center", gap: "9px", padding: "18px 20px 16px" })}>
        <span
          className={css({ width: "28px", height: "28px", borderRadius: "8px", display: "grid", placeItems: "center", fontSize: "13px", fontWeight: 700, flex: "none" })}
          style={{ background: ac.accent, color: ac.accentFg }}
        >
          A
        </span>
        <span className={css({ display: "flex", flexDirection: "column", lineHeight: 1.15 })}>
          <span className={css({ fontWeight: 700, fontSize: "14px", letterSpacing: "-0.01em" })}>AMS</span>
          <span className={css({ fontSize: "10.5px", letterSpacing: "0.07em", textTransform: "uppercase" })} style={{ color: ac.faint }}>
            Infotainment
          </span>
        </span>
      </div>

      {/* Grouped nav */}
      <nav className={css({ display: "flex", flexDirection: "column", gap: "18px", padding: "4px 12px 20px" })}>
        {groups.map((group) => (
          <div key={group.title}>
            <div
              className={css({ fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "0 11px", marginBottom: "6px" })}
              style={{ color: ac.faint }}
            >
              {group.title}
            </div>
            <div className={css({ display: "flex", flexDirection: "column", gap: "2px" })}>
              {group.items.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={navRow}
                    style={{
                      color: active ? ac.accentText : ac.sub,
                      background: active ? ac.accentTint : undefined,
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <Icon name={item.icon} size={17} strokeWidth={active ? 1.9 : 1.6} style={{ flex: "none" }} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={css({ flex: "1" })} />

      {/* The old global "Refresh data" row is gone: every screen has its own
          "Refresh · updated Xm ago" button, scoped to that screen's caches — a
          global bust would cold-start everything at once. Identity moved to the
          top bar with the restyle. */}
    </aside>
  );
}
