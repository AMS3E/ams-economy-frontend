"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { css } from "@/styled-system/css";
import { ac } from "../tokens";
import { SearchInput } from "../Dropdown";
import { Surface, Button, Input, Table, Th, Td, Tr, TableFooter, EmptyState } from "../ui";
import { Bar, SkeletonKeyframes } from "../Skeleton";
import RefreshButton from "../RefreshButton";
import ConfirmDialog from "../ConfirmDialog";
import type { TagListResult } from "@/lib/admin/tags";
import { createTag, deleteTag } from "@/lib/admin/screen-actions";

interface Query { search: string; page: number }

export default function TagManager({
  result,
  loading,
  fetching,
  error: loadError,
  fetchedAt,
  refreshing,
  onRefresh,
  onMutated,
  query,
  perPage,
}: {
  result: TagListResult;
  loading: boolean;
  fetching: boolean;
  error: boolean;
  fetchedAt: number | undefined;
  refreshing: boolean;
  onRefresh: () => void;
  /** Invalidate the tags cache after a successful create/delete. */
  onMutated: () => void;
  query: Query;
  perPage: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The term awaiting confirmation; the dialog stays up across the write so a
  // rejection lands in it instead of a native popup.
  const [confirmDel, setConfirmDel] = useState<{ id: number; name: string } | null>(null);
  const [delError, setDelError] = useState<string | null>(null);

  const go = (next: { search?: string; page?: number }) => {
    const search = next.search ?? query.search;
    const page = next.page ?? 1;
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = new FormData(e.currentTarget).get("q");
    go({ search: typeof v === "string" ? v.trim() : "" });
  };

  const submitNew = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    const res = await createTag(name);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Couldn't create."); return; }
    setNewName("");
    setAdding(false);
    onMutated(); // invalidate the client tags cache (the action busted the server tag)
  };

  const doRemove = async () => {
    const target = confirmDel;
    if (!target || busy) return;
    setBusy(true);
    setDelError(null);
    const res = await deleteTag(target.id);
    setBusy(false);
    if (!res.ok) { setDelError(res.error ?? "Couldn't delete."); return; }
    setConfirmDel(null);
    onMutated();
  };

  const { items, total, totalPages } = result;
  const start = total === 0 ? 0 : (query.page - 1) * perPage + 1;
  const end = start === 0 ? 0 : start + items.length - 1;

  return (
    <div className={css({ marginTop: "20px" })}>
      <div className={css({ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" })}>
        <form onSubmit={onSearch} className={css({ display: "flex" })}>
          <SearchInput placeholder="Search tags…" name="q" defaultValue={query.search} width="300px" />
        </form>
        <div className={css({ flex: 1 })} />
        <RefreshButton fetchedAt={fetchedAt} refreshing={refreshing} onRefresh={onRefresh} />
        <Button variant="primary" icon="plus" onClick={() => setAdding((v) => !v)}>
          New tag
        </Button>
      </div>

      {adding ? (
        <Surface style={{ marginTop: "12px", padding: "14px 16px" }}>
          <div className={css({ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" })}>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitNew();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="New tag name…"
              className={css({ flex: 1, minWidth: "220px", maxWidth: "420px" })}
            />
            <Button variant="primary" disabled={busy} onClick={() => void submitNew()}>
              {busy ? "Creating…" : "Create"}
            </Button>
            <Button onClick={() => { setAdding(false); setError(null); }}>Cancel</Button>
          </div>
        </Surface>
      ) : null}

      {error ? (
        <p role="alert" className={css({ fontSize: "12.5px", marginTop: "12px", padding: "9px 11px", borderRadius: "9px" })} style={{ color: ac.danger, background: ac.dangerTint, border: `1px solid ${ac.danger}` }}>
          {error}
        </p>
      ) : null}

      <Surface style={{ marginTop: "16px", overflow: "hidden" }}>
        <div style={{ opacity: fetching && !loading ? 0.55 : 1, transition: "opacity .15s" }}>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th width="110px" align="right">Posts</Th>
                <Th width="110px" align="right" />
              </tr>
            </thead>
            <tbody>
              {loading && !loadError ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} aria-busy>
                    <Td><Bar w={i % 2 ? 170 : 120} h={14} /></Td>
                    <Td align="right"><Bar w={40} h={12} /></Td>
                    <Td />
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <Td colSpan={3}>
                    <EmptyState icon="x" title="Couldn't load tags" body="WordPress didn't answer. Use Refresh to try again." />
                  </Td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <Td colSpan={3}>
                    <EmptyState
                      icon="tag"
                      title="No tags found"
                      body={query.search ? "Try clearing the search." : "Nothing has been tagged yet."}
                    />
                  </Td>
                </tr>
              ) : (
                items.map((t) => (
                  <Tr key={t.id} className={css({ "&:hover [data-del]": { opacity: 1 } })}>
                    <Td>
                      <span className={css({ fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" })}>{t.name}</span>
                    </Td>
                    <Td align="right">
                      <span className={css({ fontSize: "12.5px", fontVariantNumeric: "tabular-nums" })} style={{ color: ac.muted }}>
                        {t.count.toLocaleString("en-US")}
                      </span>
                    </Td>
                    <Td align="right">
                      <span data-del className={css({ display: "inline-flex", opacity: 0, transition: "opacity .12s", _focusWithin: { opacity: 1 } })}>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setDelError(null);
                            setConfirmDel({ id: t.id, name: t.name });
                          }}
                        >
                          Delete
                        </Button>
                      </span>
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
          <SkeletonKeyframes />
        </div>
        <TableFooter>
          <span>
            {loading ? <Bar w={90} h={13} /> : total === 0 ? "No results" : `${start.toLocaleString("en-US")}–${end.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}`}
          </span>
          <span className={css({ display: "flex", gap: "6px" })}>
            <Button size="sm" icon="chevronLeft" disabled={query.page <= 1} onClick={() => go({ page: query.page - 1 })}>
              Previous
            </Button>
            <Button size="sm" iconRight="chevronRight" disabled={query.page >= totalPages} onClick={() => go({ page: query.page + 1 })}>
              Next
            </Button>
          </span>
        </TableFooter>
      </Surface>

      {confirmDel ? (
        <ConfirmDialog
          title="Delete this tag?"
          confirmLabel="Delete tag"
          busyLabel="Deleting…"
          busy={busy}
          error={delError}
          onConfirm={() => void doRemove()}
          onCancel={() => {
            setConfirmDel(null);
            setDelError(null);
          }}
        >
          <strong style={{ color: ac.text, fontWeight: 600 }}>{confirmDel.name}</strong> is removed from the site.
          Posts keep their content — they just lose this tag.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
