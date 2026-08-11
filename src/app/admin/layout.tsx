import type { Metadata } from "next";
import { css } from "@/styled-system/css";
import { ac } from "@/components/admin/tokens";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";
import QueryProvider from "@/components/admin/QueryProvider";
import { requireSession, type SessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin",
  // The tool is internal; keep it out of search results regardless of auth.
  robots: { index: false, follow: false },
};

/** First+last initial (or first two chars for a single-token name). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "seo_manager" → "Seo Manager". Roles are Latin slugs, so this is safe. */
function roleLabel(roles: string[]): string {
  const slug = roles[0] ?? "";
  return slug ? slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";
}

function toSidebarUser(user: SessionUser) {
  return { name: user.name, initials: initialsOf(user.name), roleLabel: roleLabel(user.roles) };
}

// The admin tool's own shell. It sits directly under the thin root layout, so it
// shares nothing with the public site's chrome — its own sidebar + canvas, and
// no dependency on the public nav API. Fixed 220px sidebar, scrolling content.
//
// requireSession() is the app-level gate (redirects to /login when there's no
// valid session), belt-and-suspenders with proxy.ts. It is NOT the security
// boundary — layouts don't re-render on client navigation, so an expired session
// surfaces on the next WordPress call (a 401), where the API layer forces a fresh
// login. WordPress enforces every capability regardless.
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await requireSession();

  return (
    <QueryProvider>
      <div
        className={css({ display: "flex", minHeight: "100vh", fontSize: "14px" })}
        style={{ background: ac.canvas, color: ac.text }}
      >
        <AdminSidebar capabilities={user.capabilities} />
        <div className={css({ flex: "1", minWidth: 0, display: "flex", flexDirection: "column" })}>
          <AdminTopBar user={toSidebarUser(user)} />
          {children}
        </div>
      </div>
    </QueryProvider>
  );
}
