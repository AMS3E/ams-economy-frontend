// Client-safe admin constants — NO server imports (next/headers etc.), so both
// the server data layer and Client Components can import the values here.

/** Statuses the article list shows by default (skips future/private/trash). */
export const DEFAULT_STATUSES = "publish,draft,pending";

/** The WordPress menu behind the public site's program-icon strip
 *  (មាតិកាឌីជីថល). Its SLUG, not its id — ids differ between environments.
 *  Lives here rather than in lib/admin/menus.ts because the Menus screen is a
 *  Client Component: value-importing it from that module would pull adminFetch
 *  (and next/headers with it) into the browser bundle. */
export const PROGRAM_ICON_MENU = "ams-infotainment-third-menu";

/** Windows the dashboard's range control offers, and the ceiling on what the
 *  fast path will aggregate. A 365-day roll-up of WordPress Popular Posts'
 *  summary table measured 57 SECONDS live (30 and 90 days are fine), so this
 *  list is a measurement, not a preference.
 *
 *  Here rather than in lib/admin/dashboard.ts for the same reason as
 *  PROGRAM_ICON_MENU above: DashboardScreen is a Client Component, and
 *  value-importing these from that module would pull adminFetch — and
 *  next/headers with it — into the browser bundle. (Types may still be
 *  imported from there; `import type` is erased.) */
export const DASH_RANGES = [7, 30, 90] as const;
export type DashRange = (typeof DASH_RANGES)[number];

export function clampRange(raw: unknown): DashRange {
  const n = Number(raw);
  return (DASH_RANGES as readonly number[]).includes(n) ? (n as DashRange) : 30;
}
