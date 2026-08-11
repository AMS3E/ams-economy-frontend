"use client";

import Link from "next/link";
import { useState } from "react";
import { css } from "@/styled-system/css";
import { ac, type Status } from "../tokens";
import { Icon } from "../icons";
import { SearchInput } from "../Dropdown";
import {
  Surface,
  PageHeader,
  Badge,
  Button,
  buttonClass,
  Segmented,
  StatusPill,
  Table,
  Th,
  Td,
  Tr,
  TableFooter,
  EmptyState,
} from "../ui";
import { Bar, SkeletonKeyframes } from "../Skeleton";
import RefreshButton from "../RefreshButton";
import type { ProgramItem } from "@/lib/admin/programs";

function statusDisplay(raw: string): Status {
  if (raw === "publish") return "Published";
  if (raw === "pending") return "Pending";
  return "Draft";
}

const isKhmer = (s: string) => /[ក-៿]/.test(s);

export default function ProgramsView({
  programs,
  loading,
  error,
  fetchedAt,
  refreshing,
  onRefresh,
}: {
  programs: ProgramItem[];
  loading: boolean;
  error: boolean;
  fetchedAt: number | undefined;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  // Case-insensitive: Khmer has no case, but half these titles are Latin and a
  // case-sensitive contains() made "Studio" and "studio" different searches.
  const q = search.trim().toLowerCase();
  const list = programs.filter((p) => !q || p.title.toLowerCase().includes(q));

  const sub = loading
    ? "Loading…"
    : q
      ? `${list.length.toLocaleString("en-US")} of ${programs.length.toLocaleString("en-US")} programs`
      : `${programs.length.toLocaleString("en-US")} programs`;

  // Movie vs TV Show is only worth a column when the library actually holds
  // both. Today every one of the 23 is a Movie, so a "Movie" badge on 23 of 23
  // rows would be decoration — and the design system's rule is that colour and
  // chrome inform or they don't ship. It comes back on its own the day a
  // tv_show appears.
  const mixedTypes = new Set(programs.map((p) => p.type)).size > 1;

  const body = loading ? (
    view === "grid" ? (
      <div className={gridClass} aria-busy>
        {Array.from({ length: 8 }, (_, i) => (
          <Surface key={i} style={{ overflow: "hidden" }}>
            <div className={css({ aspectRatio: "16/9" })} style={{ background: ac.skeleton, borderBottom: `1px solid ${ac.border}` }} />
            <div className={css({ padding: "12px 14px 14px" })}>
              <Bar w={i % 2 ? "80%" : "60%"} h={14} />
              <div style={{ marginTop: 10 }}>
                <Bar w={90} h={12} />
              </div>
            </div>
          </Surface>
        ))}
        <SkeletonKeyframes />
      </div>
    ) : (
      <Surface style={{ marginTop: "16px", overflow: "hidden" }}>
        <Table>
          <thead>
            <tr>
              <Th width="66px" />
              <Th>Title</Th>
              <Th width="120px">Status</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }, (_, i) => (
              <tr key={i} aria-busy>
                <Td><Bar w={38} h={56} r={6} /></Td>
                <Td><Bar w={i % 2 ? "62%" : "44%"} h={15} /></Td>
                <Td><Bar w={78} h={20} r={99} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <SkeletonKeyframes />
      </Surface>
    )
  ) : error ? (
    <Surface style={{ marginTop: "16px" }}>
      <EmptyState icon="x" title="Couldn't load programs" body="WordPress didn't answer. Use Refresh to try again." />
    </Surface>
  ) : list.length === 0 ? (
    <Surface style={{ marginTop: "16px" }}>
      <EmptyState
        icon="programs"
        title="No programs match"
        body={q ? "Try a shorter search term." : "No movies or shows exist yet."}
        action={
          q ? (
            <Button onClick={() => setSearch("")}>Clear search</Button>
          ) : (
            <Link href="/admin/programs/new" className={buttonClass("primary")}>
              <Icon name="plus" size={14} strokeWidth={2} />
              New program
            </Link>
          )
        }
      />
    </Surface>
  ) : view === "grid" ? (
    <div className={gridClass}>
      {list.map((p) => (
        <Surface key={p.id} hover style={{ overflow: "hidden" }}>
          {/* The card IS the link, so the whole tile is one keyboard stop and
              one hit target — the grid's rows have no other action. */}
          <Link href={`/admin/programs/${p.id}`} className={cardLinkClass}>
            {p.poster ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail; next/image needs remotePatterns for the S3 host
              <img src={p.poster} alt="" className={css({ width: "100%", display: "block" })} style={{ aspectRatio: "16/9", objectFit: "cover", borderBottom: `1px solid ${ac.border}` }} />
            ) : (
              <div className={css({ aspectRatio: "16/9" })} style={{ background: ac.skeleton, borderBottom: `1px solid ${ac.border}` }} />
            )}
            <div className={css({ padding: "12px 14px 14px" })}>
              <div className={css({ lineHeight: 1.5, fontWeight: 500, lineClamp: 2, minHeight: "42px" })} style={{ fontSize: isKhmer(p.title) ? "15px" : "14px" }}>
                {p.title}
              </div>
              <div className={css({ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", flexWrap: "wrap" })}>
                <StatusPill status={statusDisplay(p.status)} />
                {mixedTypes ? <Badge>{p.type}</Badge> : null}
              </div>
            </div>
          </Link>
        </Surface>
      ))}
    </div>
  ) : (
    <Surface style={{ marginTop: "16px", overflow: "hidden" }}>
      <Table>
        <thead>
          <tr>
            <Th width="66px" />
            <Th>Title</Th>
            {mixedTypes ? <Th width="120px">Type</Th> : null}
            <Th width="120px">Status</Th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <Tr key={p.id} className={css({ "&:hover [data-thumb]": { borderColor: "var(--colors-admin-border-strong)" } })}>
              <Td>
                {p.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail; next/image needs remotePatterns for the S3 host
                  <img data-thumb src={p.poster} alt="" style={{ width: 38, height: 56, objectFit: "cover", borderRadius: 6, border: `1px solid ${ac.border}`, transition: "border-color .12s", display: "block" }} />
                ) : (
                  <div data-thumb style={{ width: 38, height: 56, borderRadius: 6, background: ac.skeleton, border: `1px solid ${ac.border}`, transition: "border-color .12s" }} />
                )}
              </Td>
              <Td>
                {/* The ROW is not the link — a <tr> cannot be an anchor. The
                    title carries it, as on Articles, which also gives keyboard
                    users one stop per row instead of one per cell. */}
                <Link href={`/admin/programs/${p.id}`} className={css({ fontSize: "14px", lineHeight: 1.5, lineClamp: 2, display: "block", _hover: { textDecoration: "underline" } })}>
                  {p.title}
                </Link>
              </Td>
              {mixedTypes ? <Td><Badge>{p.type}</Badge></Td> : null}
              <Td><StatusPill status={statusDisplay(p.status)} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <TableFooter>
        <span>
          {list.length === programs.length
            ? `${programs.length.toLocaleString("en-US")} programs`
            : `${list.length.toLocaleString("en-US")} of ${programs.length.toLocaleString("en-US")}`}
        </span>
        {/* Both read paths return every program in one call — there is no page
            to turn, so the footer carries the count alone rather than dead
            pager buttons. */}
        <span />
      </TableFooter>
    </Surface>
  );

  return (
    <div className={css({ padding: "28px 32px 48px", maxWidth: "1440px" })}>
      <PageHeader
        trail={[{ label: "Content" }, { label: "Programs" }]}
        title="Programs"
        sub={sub}
        actions={
          <>
            <RefreshButton fetchedAt={fetchedAt} refreshing={refreshing} onRefresh={onRefresh} />
            <Link href="/admin/programs/new" className={buttonClass("primary")}>
              <Icon name="plus" size={14} strokeWidth={2} />
              New program
            </Link>
          </>
        }
      />

      <div className={css({ display: "flex", alignItems: "center", gap: "10px", marginTop: "20px", flexWrap: "wrap" })}>
        <form onSubmit={(e) => e.preventDefault()} className={css({ display: "flex" })}>
          <SearchInput placeholder="Search programs…" value={search} onValueChange={setSearch} width="300px" />
        </form>
        <div className={css({ flex: 1 })} />
        <Segmented
          ariaLabel="Layout"
          value={view}
          onChange={setView}
          options={[
            { value: "grid", label: "Grid" },
            { value: "list", label: "List" },
          ]}
        />
      </div>

      {body}
    </div>
  );
}

const gridClass = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
  gap: "16px",
  marginTop: "16px",
});

/** The anchor fills the card so the hover lift and the hit target are the same
 *  rectangle; the ring is drawn by the anchor rather than the Surface, because
 *  the anchor is what actually takes focus. */
const cardLinkClass = css({
  display: "block",
  borderRadius: "14px",
  overflow: "hidden",
  _focusVisible: { outline: "2px solid var(--colors-admin-focus)", outlineOffset: "2px" },
});
