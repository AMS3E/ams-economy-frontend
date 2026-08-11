"use client";

// The newsroom's morning screen, on Aurora's composition.
//
// LAYOUT: one full-bleed panel whose cells butt against each other, separated
// by 1px rules rather than floating on gutters. That is the single biggest
// reason the reference dashboards read as an instrument panel and our previous
// version read as a content page, and it is what the owner asked for.
//
// The cells, left to right, top to bottom:
//   1. the greeting — the day, and the day's numbers (Aurora's move: the
//      greeting earns its cell by carrying the queue, not just a hello)
//   2. two KPI cells — number, delta vs the previous period, sparkline
//   3. the trend panel — pageviews over stories published, one shared x-axis
//   4. top performing + who's publishing
//   5. the whole edit stream
//
// The CONTENT is unchanged from the rebuild that preceded the restyle: an
// editor's three morning questions, answered with real newsroom data rather
// than four counters scoped to the reader's own authorship (which measured
// 0 / 0 / 0 / 1 for the administrator account against a newsroom publishing
// ~4 stories a day).
//
// Scope is `edit_others_posts`, decided server-side. The range control scopes
// every dated view below it; the two KPI cells are pinned to 7-vs-prior-7 and
// say so, because a 90-day comparison would need 180 days of WPP's summary
// table and a 365-day aggregate of it measured 57 seconds live.

import Link from "next/link";
import { useState } from "react";
import { css } from "@/styled-system/css";
import { ac, type Status } from "./tokens";
import { Icon, type IconName } from "./icons";
import { StatusPill, Segmented, buttonClass, Table, Th, Td, Tr } from "./ui";
import { Bar, SkeletonKeyframes } from "./Skeleton";
import RefreshButton from "./RefreshButton";
import { TrendPanel, RankBars, ShareRule, Sparkline, Delta } from "./charts";
import { useDashboard, useScreenRefresh, adminKeys } from "@/lib/admin/queries";
// Values from constants (client-safe); the data SHAPES stay type-only imports.
import { DASH_RANGES, type DashRange } from "@/lib/admin/constants";

const QUICK = [
  { label: "New Article", href: "/admin/articles/new", icon: "plus" as const, primary: true },
  { label: "New Program", href: "/admin/programs/new", icon: "plus" as const },
  { label: "Upload media", href: "/admin/media", icon: "upload" as const },
];

function statusDisplay(raw: string): Status {
  if (raw === "publish") return "Published";
  if (raw === "pending") return "Pending";
  if (raw === "private") return "Private";
  return "Draft";
}

/** Programs and episodes ride the same activity feed as articles and must open
 *  in their own editor — a movie id on /admin/articles/ is a 404. */
function hrefFor(type: string, id: number): string {
  return type === "post" ? `/admin/articles/${id}` : `/admin/programs/${id}`;
}

const TYPE_LABEL: Record<string, string> = { movie: "Program", tv_show: "Program", episode: "Episode" };

/** Whole days between an ISO site-local stamp and now. Parsed by parts: a bare
 *  date string handed to `new Date()` is treated as UTC, which would shift the
 *  answer by a day in Phnom Penh. */
function daysSince(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const then = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  return Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - then.getTime()) / 86400000);
}

function ago(iso: string): string {
  const d = daysSince(iso);
  if (d === null) return "";
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  const months = Math.round(d / 30);
  return months <= 1 ? "a month ago" : `${months} months ago`;
}

/* -------------------------------------------------------------------------- *
 * The panel. One surface, cells divided by rules — no gutters.
 * -------------------------------------------------------------------------- */

const panel = css({
  borderRadius: "16px",
  border: "1px solid var(--colors-admin-border)",
  background: "var(--colors-admin-surface)",
  boxShadow: "var(--shadows-admin-sm)",
  overflow: "hidden",
});

/** A cell. `right`/`bottom` draw the dividing rules — only where a neighbour
 *  actually sits, so the panel never shows a rule against its own edge. */
function Cell({
  children,
  right = false,
  bottom = false,
  span,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  right?: boolean;
  bottom?: boolean;
  span?: string;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={className}
      style={{
        gridColumn: span,
        padding: padded ? "20px 22px" : undefined,
        borderRight: right ? `1px solid ${ac.border}` : undefined,
        borderBottom: bottom ? `1px solid ${ac.border}` : undefined,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

export default function DashboardScreen({ firstName }: { firstName: string }) {
  const [range, setRange] = useState<DashRange>(30);
  const dashboard = useDashboard(range);
  const { refreshing, refresh } = useScreenRefresh("dashboard", [adminKeys.dashboardRoot]);

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Phnom_Penh",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const data = dashboard.data;
  const loading = dashboard.isPending;
  const stale = dashboard.isPlaceholderData;

  const queue = data?.queue;
  const kpi = data?.kpi;
  const series = data?.series ?? null;
  // Optimistic while loading: deciding the leaderboard cell only once `data`
  // lands would reflow the whole bottom band.
  const newsroom = data ? data.scope === "all" : true;
  const rangeLabel = `last ${range} days`;

  // The sparklines show the last 14 days — the window the KPI delta compares —
  // rather than the whole selected range, so tile and delta describe the same
  // stretch of time.
  const sparkViews = series ? series.slice(-14).map((p) => p.views) : [];
  const sparkPosts = series ? series.slice(-14).map((p) => p.posts) : [];

  return (
    <div className={css({ padding: "26px 32px 44px", maxWidth: "1520px" })}>
      {/* ---- page header ---- */}
      <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "18px" })}>
        <h1 className={css({ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.02em" })}>Dashboard</h1>
        <div className={css({ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" })}>
          <RefreshButton fetchedAt={data?.fetchedAt} refreshing={refreshing} onRefresh={refresh} />
          {QUICK.map((q) => (
            <Link key={q.label} href={q.href} className={buttonClass(q.primary ? "primary" : "secondary")}>
              <Icon name={q.icon} size={14} strokeWidth={2} />
              {q.label}
            </Link>
          ))}
        </div>
      </div>

      {dashboard.isError ? (
        <div className={css({ marginBottom: "16px", padding: "16px 20px", borderRadius: "12px", fontSize: "13px" })} style={{ background: ac.dangerTint, border: `1px solid ${ac.danger}`, color: ac.danger }}>
          Couldn&rsquo;t load the dashboard from WordPress. Use Refresh to try again.
        </div>
      ) : null}

      <div style={{ opacity: stale ? 0.55 : 1, transition: "opacity .15s" }}>
        {/* ================= panel 1: greeting · KPI · KPI · queue ============ */}
        <div className={cx2(panel, css({ display: "grid", gridTemplateColumns: "minmax(260px,1.05fr) minmax(200px,1fr) minmax(200px,1fr) minmax(280px,1.15fr)" }))}>
          {/* greeting */}
          <Cell right>
            <div className={css({ fontSize: "12.5px" })} style={{ color: ac.muted }}>{dateLabel}</div>
            <div className={css({ fontSize: "21px", fontWeight: 600, letterSpacing: "-0.02em", marginTop: "6px", lineHeight: 1.25 })}>
              Good morning,
              <br />
              {firstName}
            </div>
            <div style={{ height: 1, background: ac.border, margin: "16px 0 14px" }} />
            <div className={css({ fontSize: "12px", marginBottom: "10px" })} style={{ color: ac.muted }}>
              Across the newsroom
            </div>
            {loading || !queue ? (
              <div className={css({ display: "flex", flexDirection: "column", gap: "9px" })}>
                <Bar w="70%" h={15} />
                <Bar w="55%" h={15} />
              </div>
            ) : (
              <div className={css({ display: "flex", flexDirection: "column", gap: "9px" })}>
                <MiniStat value={queue.drafts} label="drafts in the pipeline" />
                <MiniStat value={queue.pending} label={queue.pending === 1 ? "story in review" : "stories in review"} />
                {queue.scheduled > 0 ? <MiniStat value={queue.scheduled} label="scheduled and stuck" warn /> : null}
              </div>
            )}
          </Cell>

          {/* KPI: pageviews */}
          <Cell right>
            <KpiCell
              label="Pageviews"
              sub="last 7 days"
              value={kpi?.views7 ?? null}
              loading={loading || !kpi}
              unavailable="Needs the fast read path"
              delta={kpi ? <Delta current={kpi.views7} previous={kpi.viewsPrev7} label="vs prior 7 days" /> : null}
              spark={sparkViews}
              kind="line"
            />
          </Cell>

          {/* KPI: published */}
          <Cell right>
            <KpiCell
              label={newsroom ? "Stories published" : "You published"}
              sub="last 7 days"
              value={kpi?.published7 ?? null}
              loading={loading || !kpi}
              delta={kpi ? <Delta current={kpi.published7} previous={kpi.publishedPrev7} label="vs prior 7 days" /> : null}
              spark={sparkPosts}
              kind="bars"
            />
          </Cell>

          {/* the queue, as work you can open */}
          <Cell>
            <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" })}>
              <span className={css({ fontSize: "13.5px", fontWeight: 600 })}>Needs you</span>
              <Link href="/admin/articles?status=pending" className={css({ fontSize: "12px", display: "flex", alignItems: "center", gap: "3px" })} style={{ color: ac.muted }}>
                Review <Icon name="arrowRight" size={12} strokeWidth={2} />
              </Link>
            </div>
            <div className={css({ display: "flex", flexDirection: "column", gap: "2px", marginTop: "10px" })}>
              {loading || !queue ? (
                <>
                  <Bar w="100%" h={46} r={10} />
                  <Bar w="100%" h={46} r={10} />
                </>
              ) : queue.pending === 0 && queue.drafts === 0 && queue.scheduled === 0 ? (
                <div className={css({ fontSize: "13px", padding: "12px 0" })} style={{ color: ac.muted }}>
                  Nothing waiting. The queue is clear.
                </div>
              ) : (
                <>
                  {queue.pending > 0 ? (
                    <QueueRow
                      icon="clock"
                      href="/admin/articles?status=pending"
                      count={queue.pending}
                      label={queue.pending === 1 ? "story in review" : "stories in review"}
                      note={queue.oldest ? `oldest ${ago(queue.oldest.date)}${queue.oldest.authorName ? ` · ${queue.oldest.authorName}` : ""}` : undefined}
                      warn={queue.oldest ? (daysSince(queue.oldest.date) ?? 0) >= 2 : false}
                    />
                  ) : null}
                  {queue.drafts > 0 ? (
                    <QueueRow
                      icon="pencil"
                      href="/admin/articles?status=draft"
                      count={queue.drafts}
                      label={newsroom ? "drafts in the pipeline" : "of your drafts"}
                      note={queue.draftsStale > 0 ? `${queue.draftsStale} untouched for 30 days` : undefined}
                    />
                  ) : null}
                  {/* Only when it bites: this server's loopback is broken, so
                      WP-Cron never fires and a scheduled post never publishes. */}
                  {queue.scheduled > 0 ? (
                    <QueueRow
                      icon="calendar"
                      href="/admin/articles?status=future"
                      count={queue.scheduled}
                      label={queue.scheduled === 1 ? "scheduled story is stuck" : "scheduled stories are stuck"}
                      note="this server never publishes them — WP-Cron is broken"
                      warn
                    />
                  ) : null}
                </>
              )}
            </div>
          </Cell>
        </div>

        {/* ================= panel 2: the trend ============================== */}
        <div className={cx2(panel, css({ marginTop: "16px" }))}>
          <div className={css({ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", padding: "18px 22px 4px", flexWrap: "wrap" })}>
            <div>
              <div className={css({ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" })}>Traffic &amp; publishing</div>
              <div className={css({ fontSize: "12.5px", marginTop: "3px" })} style={{ color: ac.muted }}>
                Daily pageviews over stories published · {rangeLabel}
              </div>
            </div>
            <Segmented
              ariaLabel="Date range"
              value={range}
              onChange={(v) => setRange(v as DashRange)}
              options={DASH_RANGES.map((r) => ({ value: r as number, label: `${r} days` }))}
            />
          </div>
          <div className={css({ padding: "0 22px 14px" })}>
            {loading ? (
              <Bar w="100%" h={220} r={10} />
            ) : !series ? (
              <ChartEmpty text="Trend data needs the fast read path. WordPress REST exposes per-story totals and a top-five, but no daily timeline — so nothing is drawn rather than a flat line that would read as real." />
            ) : (
              <>
                <TrendPanel series={series} hasViews={data?.hasViews ?? false} />
                {!data?.hasViews ? (
                  <div className={css({ fontSize: "11.5px", marginTop: "6px" })} style={{ color: ac.faint }}>
                    Pageviews unavailable — the analytics table is missing. Publishing volume is real.
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* ================= panel 3: what is working ======================== */}
        <div
          className={cx2(panel, css({ marginTop: "16px", display: "grid" }))}
          style={{ gridTemplateColumns: newsroom ? "minmax(0,1.9fr) minmax(260px,1fr)" : "1fr" }}
        >
          <Cell right={newsroom} padded={false}>
            <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px 12px" })}>
              <div>
                <div className={css({ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" })}>Top performing</div>
                <div className={css({ fontSize: "12.5px", marginTop: "3px" })} style={{ color: ac.muted }}>
                  Most-read stories · {rangeLabel}
                </div>
              </div>
              <Link href="/admin/articles" className={css({ fontSize: "12px", display: "flex", alignItems: "center", gap: "3px" })} style={{ color: ac.muted }}>
                View all <Icon name="arrowRight" size={12} strokeWidth={2} />
              </Link>
            </div>
            {loading ? (
              <SkeletonRows count={5} />
            ) : !data || data.top.length === 0 ? (
              <EmptyRow text="No view data yet." />
            ) : (
              data.top.map((a, i) => (
                <Link key={a.id} href={`/admin/articles/${a.id}`} className={css({ display: "block", padding: "11px 22px", cursor: "pointer", _hover: { background: "var(--colors-admin-surface-hover)" } })} style={{ borderTop: `1px solid ${ac.rowLine}` }}>
                  <div className={css({ display: "flex", alignItems: "center", gap: "14px" })}>
                    <div className={css({ fontSize: "12px", fontWeight: 600, width: "16px", flex: "none", textAlign: "center" })} style={{ color: ac.faint }}>{i + 1}</div>
                    <div className={css({ flex: 1, minWidth: 0, fontSize: "14px", lineHeight: 1.5, lineClamp: 1 })}>{a.title}</div>
                    <div className={css({ fontSize: "13px", fontVariantNumeric: "tabular-nums", flex: "none" })} style={{ color: ac.sub }}>
                      {a.views.toLocaleString("en-US")} <span style={{ color: ac.faint }}>views</span>
                    </div>
                  </div>
                  <div className={css({ display: "flex", gap: "14px" })}>
                    <div className={css({ width: "16px", flex: "none" })} />
                    <div className={css({ flex: 1, minWidth: 0 })}>
                      <ShareRule value={a.views} max={data.top[0].views} />
                      {a.authorName || a.categoryNames.length ? (
                        <div className={css({ fontSize: "12px", marginTop: "6px", lineClamp: 1 })} style={{ color: ac.muted }}>
                          {[a.authorName, a.categoryNames[0], a.date ? ago(a.date) : ""].filter(Boolean).join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </Cell>

          {/* Own-scope readers do not get a leaderboard they are ranked in. */}
          {newsroom ? (
            <Cell>
              <div className={css({ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" })}>Who&rsquo;s publishing</div>
              <div className={css({ fontSize: "12.5px", marginTop: "3px" })} style={{ color: ac.muted }}>
                Stories filed · {rangeLabel}
              </div>
              <div className={css({ marginTop: "16px" })}>
                {loading ? (
                  <Bar w="100%" h={130} r={10} />
                ) : !data?.authors || data.authors.length === 0 ? (
                  <div className={css({ fontSize: "12.5px", lineHeight: 1.6 })} style={{ color: ac.muted }}>
                    {data && data.series === null
                      ? "Needs the fast read path — a leaderboard over WordPress REST would be one call per author."
                      : "Nothing published in this window."}
                  </div>
                ) : (
                  <RankBars rows={data.authors} />
                )}
              </div>
            </Cell>
          ) : null}
        </div>

        {/* ================= panel 4: the edit stream ======================== */}
        <div className={cx2(panel, css({ marginTop: "16px" }))}>
          <div className={css({ padding: "18px 22px 12px" })}>
            <div className={css({ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" })}>Recent activity</div>
            <div className={css({ fontSize: "12.5px", marginTop: "3px" })} style={{ color: ac.muted }}>
              Everything edited most recently — articles, programs and episodes
            </div>
          </div>
          {/* A real table, like the Users list — same header band, same row
              rules, so the two screens read as one system. The whole row is the
              hit target; the title carries the link so keyboard users get one
              stop per row rather than one per cell. */}
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th width="110px">Type</Th>
                <Th width="200px">Author</Th>
                <Th width="130px">Last edited</Th>
                <Th width="120px">Status</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} aria-busy>
                    <Td><Bar w={i % 2 ? "58%" : "44%"} h={14} /></Td>
                    <Td><Bar w={54} h={18} r={6} /></Td>
                    <Td><Bar w={120} h={12} /></Td>
                    <Td><Bar w={70} h={12} /></Td>
                    <Td><Bar w={72} h={20} r={99} /></Td>
                  </tr>
                ))
              ) : !data || data.recent.length === 0 ? (
                <tr>
                  <Td colSpan={5}>
                    <div className={css({ padding: "26px", fontSize: "13px", textAlign: "center" })} style={{ color: ac.muted }}>
                      No recent edits.
                    </div>
                  </Td>
                </tr>
              ) : (
                data.recent.map((r) => (
                  <Tr key={`${r.type}-${r.id}`}>
                    <Td>
                      <Link
                        href={hrefFor(r.type, r.id)}
                        className={css({ fontSize: "14px", lineHeight: 1.5, lineClamp: 1, display: "block", _hover: { textDecoration: "underline" } })}
                      >
                        {r.title}
                      </Link>
                    </Td>
                    <Td>
                      <span className={css({ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", whiteSpace: "nowrap" })} style={{ background: ac.neutralTint, color: ac.muted }}>
                        {TYPE_LABEL[r.type] ?? "Article"}
                      </span>
                    </Td>
                    <Td>
                      <span className={css({ fontSize: "12.5px", lineClamp: 1, display: "block" })} style={{ color: ac.muted }}>
                        {r.authorName || "—"}
                      </span>
                    </Td>
                    {/* Ordered by last edit, so labelled by last edit. */}
                    <Td>
                      <span className={css({ fontSize: "12.5px" })} style={{ color: ac.muted }}>
                        {r.modified ? ago(r.modified) : r.date}
                      </span>
                    </Td>
                    <Td>
                      <StatusPill status={statusDisplay(r.status)} />
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </div>
      <SkeletonKeyframes />
    </div>
  );
}

/** Local class-joiner — `cx` from Panda is imported by ui.tsx, and pulling the
 *  whole styled-system helper in here for two joins is not worth it. */
function cx2(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Number + label, the compact form used in the greeting cell. */
function MiniStat({ value, label, warn = false }: { value: number; label: string; warn?: boolean }) {
  return (
    <div className={css({ display: "flex", alignItems: "baseline", gap: "8px" })}>
      <span className={css({ fontSize: "19px", fontWeight: 600, letterSpacing: "-0.01em" })} style={{ color: warn ? ac.warn : undefined }}>
        {value.toLocaleString("en-US")}
      </span>
      <span className={css({ fontSize: "12.5px" })} style={{ color: warn ? ac.warn : ac.muted }}>{label}</span>
    </div>
  );
}

/** KPI cell: label + period, big number, delta, sparkline. */
function KpiCell({
  label,
  sub,
  value,
  delta,
  spark,
  kind,
  loading,
  unavailable,
}: {
  label: string;
  sub: string;
  value: number | null;
  delta: React.ReactNode;
  spark: number[];
  kind: "line" | "bars";
  loading: boolean;
  unavailable?: string;
}) {
  return (
    <div className={css({ display: "flex", flexDirection: "column", height: "100%" })}>
      <div className={css({ fontSize: "13.5px", fontWeight: 600 })}>{label}</div>
      <div className={css({ fontSize: "12px", marginTop: "2px" })} style={{ color: ac.muted }}>{sub}</div>
      {loading ? (
        <div className={css({ marginTop: "14px" })}>
          <Bar w={100} h={30} />
        </div>
      ) : value === null ? (
        <div className={css({ fontSize: "13px", marginTop: "14px", lineHeight: 1.5 })} style={{ color: ac.faint }}>
          {unavailable ?? "Unavailable"}
        </div>
      ) : (
        <>
          <div className={css({ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", marginTop: "12px" })}>
            <span className={css({ fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1 })}>
              {value.toLocaleString("en-US")}
            </span>
            {spark.length ? <Sparkline values={spark} kind={kind} /> : null}
          </div>
          <div className={css({ marginTop: "10px" })}>{delta}</div>
        </>
      )}
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div aria-busy>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={css({ display: "flex", alignItems: "center", gap: "14px", padding: "12px 22px" })} style={{ borderTop: `1px solid ${ac.rowLine}` }}>
          <Bar w={i % 2 ? "52%" : "40%"} h={14} />
          <div className={css({ flex: 1 })} />
          <Bar w={70} h={13} />
        </div>
      ))}
    </div>
  );
}

function QueueRow({
  icon,
  count,
  label,
  href,
  note,
  warn = false,
}: {
  icon: IconName;
  count: number;
  label: string;
  href: string;
  note?: string;
  warn?: boolean;
}) {
  return (
    <Link href={href} className={css({ display: "flex", alignItems: "flex-start", gap: "11px", padding: "10px", borderRadius: "10px", cursor: "pointer", transition: "background .12s", _hover: { background: "var(--colors-admin-surface-hover)" } })}>
      <span
        className={css({ width: "28px", height: "28px", borderRadius: "9px", display: "grid", placeItems: "center", flex: "none" })}
        style={{ background: warn ? ac.warnTint : ac.neutralTint, color: warn ? ac.warn : ac.muted }}
      >
        <Icon name={icon} size={15} strokeWidth={1.9} />
      </span>
      <span className={css({ flex: 1, minWidth: 0 })}>
        <span className={css({ display: "block", fontSize: "14px" })}>
          <span className={css({ fontWeight: 600 })}>{count.toLocaleString("en-US")}</span>{" "}
          <span className={css({ fontSize: "13px" })} style={{ color: ac.sub }}>{label}</span>
        </span>
        {note ? (
          <span className={css({ display: "block", fontSize: "12px", marginTop: "3px", lineHeight: 1.45 })} style={{ color: warn ? ac.warn : ac.muted }}>{note}</span>
        ) : null}
      </span>
      <Icon name="arrowRight" size={13} strokeWidth={2} style={{ color: ac.faint, flex: "none", marginTop: "6px" }} />
    </Link>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className={css({ padding: "46px 24px", fontSize: "12.5px", textAlign: "center", lineHeight: 1.6, maxWidth: "460px", marginInline: "auto" })} style={{ color: ac.muted }}>
      {text}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className={css({ padding: "22px", fontSize: "13px", textAlign: "center" })} style={{ color: ac.muted, borderTop: `1px solid ${ac.rowLine}` }}>
      {text}
    </div>
  );
}
