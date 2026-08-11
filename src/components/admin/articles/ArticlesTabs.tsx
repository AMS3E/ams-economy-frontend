"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { css } from "@/styled-system/css";
import { ac } from "../tokens";

// Section tabs for the Articles area: the list plus its taxonomy managers, kept
// together rather than dumped in Settings. Rendered by the list / categories /
// tags pages (NOT the editor). Flat sidebar stays a single "Articles" item.
const TABS = [
  { label: "Articles", href: "/admin/articles" },
  { label: "Categories", href: "/admin/articles/categories" },
  { label: "Tags", href: "/admin/articles/tags" },
];

export default function ArticlesTabs() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/admin/articles" ? pathname === href : pathname.startsWith(href);

  return (
    <div className={css({ display: "flex" })} style={{ borderBottom: `1px solid ${ac.border}` }}>
      {TABS.map((t) => {
        const on = active(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={css({ padding: "11px 2px", marginRight: "22px", fontSize: "14px", cursor: "pointer" })}
            style={{ color: on ? ac.text : ac.muted, fontWeight: on ? 500 : 400, borderBottom: `2px solid ${on ? ac.accent : "transparent"}`, marginBottom: "-1px" }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
