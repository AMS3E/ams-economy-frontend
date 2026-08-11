"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { css } from "@/styled-system/css";
import { ac } from "../tokens";
import { Icon } from "../icons";
import { Dropdown, SearchInput, type Option } from "../Dropdown";
import {
  Surface,
  PageHeader,
  Button,
  buttonClass,
  IconButton,
  Input,
  Textarea,
  Field,
  EmptyState,
  TableFooter,
} from "../ui";
import { Bar, SkeletonKeyframes } from "../Skeleton";
import RefreshButton from "../RefreshButton";
import ConfirmDialog from "../ConfirmDialog";
import type { MediaItem, MediaListResult } from "@/lib/admin/media";
import { saveMediaAlt, deleteMedia } from "@/lib/admin/screen-actions";
import { uploadImageFile } from "../upload-client";

const TYPE_OPTS: Option[] = [
  { label: "All types", value: "" },
  { label: "Image", value: "image" },
  { label: "Video", value: "video" },
  { label: "Audio", value: "audio" },
];

interface Query { search: string; type: string; page: number }

export default function MediaView({
  result,
  loading,
  fetching,
  error,
  fetchedAt,
  refreshing,
  onRefresh,
  onMutated,
  query,
  perPage,
}: {
  result: MediaListResult;
  /** First-ever load (nothing cached): the grid renders skeleton tiles. */
  loading: boolean;
  /** Any in-flight fetch (page turn, background refetch): tiles dim slightly. */
  fetching: boolean;
  error: boolean;
  fetchedAt: number | undefined;
  refreshing: boolean;
  onRefresh: () => void;
  /** Invalidate the media cache after upload / alt-save / delete. */
  onMutated: () => void;
  query: Query;
  perPage: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [typeOpen, setTypeOpen] = useState(false);
  // null = "no explicit choice" (defaults to the first item once data lands,
  // preserving the old always-open drawer); "none" = explicitly closed.
  const [selectedId, setSelectedId] = useState<number | "none" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setUploadErr(null);
    const res = await uploadImageFile(file); // never throws
    setUploading(false);
    if (!res.ok) {
      setUploadErr(res.error ?? "Upload failed.");
      return;
    }
    if (res.id) setSelectedId(res.id);
    onMutated(); // invalidate the client media cache (the route busted the server tag)
  };

  const go = (next: { search?: string; type?: string; page?: number }) => {
    const search = next.search ?? query.search;
    const type = next.type ?? query.type;
    const page = next.page ?? 1;
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (type) p.set("type", type);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = new FormData(e.currentTarget).get("q");
    go({ search: typeof v === "string" ? v.trim() : "" });
  };

  const { items, total, totalPages } = result;
  const start = total === 0 ? 0 : (query.page - 1) * perPage + 1;
  const end = start === 0 ? 0 : start + items.length - 1;
  const effectiveId = selectedId === "none" ? null : (selectedId ?? items[0]?.id ?? null);
  const sel = items.find((m) => m.id === effectiveId) ?? null;
  const typeLabel = TYPE_OPTS.find((t) => t.value === query.type)?.label ?? "Type";

  return (
    <div className={css({ display: "flex", flex: 1, alignItems: "stretch", minWidth: 0 })}>
      <div className={css({ flex: 1, minWidth: 0, padding: "28px 32px 48px" })}>
        <PageHeader
          trail={[{ label: "Content" }, { label: "Media" }]}
          title="Media"
          sub={loading ? "Loading…" : `${total.toLocaleString("en-US")} files in the library`}
          actions={
            <>
              <RefreshButton fetchedAt={fetchedAt} refreshing={refreshing} onRefresh={onRefresh} />
              {/* Upload has to be a <label> wrapping a hidden file input — a
                  <button> cannot open the file dialog — so it borrows the
                  button's classes rather than the component. */}
              <label className={buttonClass("primary")} style={{ opacity: uploading ? 0.7 : 1 }}>
                <Icon name="upload" size={14} strokeWidth={2} />
                {uploading ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  className={css({ display: "none" })}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </>
          }
        />

        {/* Filters: one row, above the content they scope. */}
        <div className={css({ display: "flex", alignItems: "center", gap: "10px", marginTop: "20px", flexWrap: "wrap" })}>
          <form onSubmit={onSearch} className={css({ display: "flex" })}>
            <SearchInput placeholder="Search media…" name="q" defaultValue={query.search} width="300px" />
          </form>
          <Dropdown
            label={query.type ? typeLabel : "Type"}
            hasValue={!!query.type}
            open={typeOpen}
            onToggle={() => setTypeOpen((v) => !v)}
            onClose={() => setTypeOpen(false)}
            options={TYPE_OPTS}
            selected={query.type}
            onSelect={(v) => go({ type: v })}
          />
          {uploadErr ? (
            <span role="alert" className={css({ fontSize: "12.5px" })} style={{ color: ac.danger }}>
              {uploadErr}
            </span>
          ) : null}
        </div>

        {/* One bordered surface holding the grid and its footer — the same
            container the list screens wrap their table in, so a grid of files
            and a table of rows read as the same kind of object. */}
        <Surface style={{ marginTop: "16px", overflow: "hidden" }}>
          {loading && !error ? (
            <div className={gridClass} aria-busy>
              {Array.from({ length: 18 }, (_, i) => (
                <div key={i}>
                  <Bar w="100%" h={126} r={10} />
                  <div style={{ marginTop: 7 }}>
                    <Bar w="80%" h={10} />
                  </div>
                </div>
              ))}
              <SkeletonKeyframes />
            </div>
          ) : error ? (
            <EmptyState icon="x" title="Couldn't load media" body="WordPress didn't answer. Use Refresh to try again." />
          ) : items.length === 0 ? (
            <EmptyState
              icon="media"
              title="No media found"
              body={query.search || query.type ? "Try clearing the search or the type filter." : "Nothing has been uploaded yet."}
            />
          ) : (
            <div className={gridClass} style={{ opacity: fetching ? 0.55 : 1, transition: "opacity .15s" }}>
              {items.map((m) => {
                const on = effectiveId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelectedId(m.id)}
                    className={tileClass}
                  >
                    <span
                      className={css({
                        position: "relative",
                        display: "flex",
                        aspectRatio: "1/1",
                        borderRadius: "10px",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        transition: "box-shadow .18s ease, transform .18s ease, border-color .12s",
                      })}
                      style={{
                        background: ac.skeleton,
                        // Selection is a ring in the accent, matching every other
                        // "this one is chosen" mark in the tool (the checkbox,
                        // the active nav item).
                        border: `1px solid ${on ? ac.accent : ac.border}`,
                        boxShadow: on ? `0 0 0 2px ${ac.accent}` : undefined,
                      }}
                    >
                      {m.type === "image" && m.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail; next/image needs remotePatterns for the S3 host
                        <img src={m.thumb} alt={m.alt} className={css({ width: "100%", height: "100%" })} style={{ objectFit: "cover" }} />
                      ) : (
                        <Icon name={m.type === "video" ? "play" : "media"} size={20} strokeWidth={1.4} style={{ color: ac.faint }} />
                      )}
                    </span>
                    <span
                      className={css({ display: "block", fontSize: "10.5px", marginTop: "7px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })}
                      style={{ fontFamily: "ui-monospace, monospace", color: on ? ac.text : ac.sub }}
                    >
                      {m.title}
                    </span>
                    <span
                      className={css({ display: "block", fontSize: "10.5px", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })}
                      style={{ color: ac.faint }}
                    >
                      {[m.dims, m.date].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <TableFooter>
            <span>
              {loading ? (
                <Bar w={140} h={13} />
              ) : total === 0 ? (
                "No results"
              ) : (
                `${start.toLocaleString("en-US")}–${end.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}`
              )}
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
      </div>

      {/* Detail drawer — keyed by item so alt-draft state resets per selection */}
      {sel ? (
        <DetailsDrawer
          key={sel.id}
          item={sel}
          onClose={() => setSelectedId("none")}
          onSaved={onMutated}
          onDeleted={() => {
            setSelectedId("none");
            onMutated();
          }}
        />
      ) : null}
    </div>
  );
}

const gridClass = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill,minmax(126px,1fr))",
  gap: "16px",
  padding: "18px",
});

/** A tile is a real <button>: the grid is a picker, and a div with an onClick
 *  gives keyboard users nothing to land on. */
const tileClass = css({
  display: "block",
  width: "100%",
  minWidth: 0,
  textAlign: "left",
  padding: 0,
  border: "none",
  background: "transparent",
  font: "inherit",
  cursor: "pointer",
  borderRadius: "10px",
  // Lift + shadow only. The tile's border is applied INLINE (it carries the
  // selected state), and an inline declaration beats any stylesheet rule — a
  // hover borderColor here would simply never land.
  _hover: { "& > span:first-child": { transform: "translateY(-3px)", boxShadow: "var(--shadows-admin-md)" } },
  _focusVisible: { outline: "2px solid var(--colors-admin-focus)", outlineOffset: "2px" },
});

function DetailsDrawer({
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: MediaItem;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [alt, setAlt] = useState(item.alt);
  const [savingAlt, setSavingAlt] = useState(false);
  const [altMsg, setAltMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const altDirty = alt.trim() !== item.alt.trim();

  const saveAlt = async () => {
    if (savingAlt) return;
    setSavingAlt(true);
    setAltMsg(null);
    const res = await saveMediaAlt(item.id, alt);
    setSavingAlt(false);
    setAltMsg(res.ok ? { kind: "ok", text: "Saved" } : { kind: "err", text: res.error ?? "Couldn't save." });
    if (res.ok) onSaved();
  };

  // PERMANENT — attachments have no trash over REST (see deleteMedia), which is
  // why this one confirms in a dialog that stays up and reports failure in
  // place: there is nothing to restore from if it goes wrong.
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteErr(null);
    const res = await deleteMedia(item.id);
    setDeleting(false);
    if (!res.ok) {
      setDeleteErr(res.error ?? "Couldn't delete the file.");
      return;
    }
    setConfirming(false);
    onDeleted();
  };

  return (
    <div
      className={css({ width: "360px", flex: "none", padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: "18px", overflowY: "auto" })}
      style={{ background: ac.surface, borderLeft: `1px solid ${ac.border}` }}
    >
      <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between" })}>
        <div className={css({ fontSize: "14px", fontWeight: 600 })}>Media details</div>
        <IconButton name="x" label="Close details" size="sm" onClick={onClose} />
      </div>

      <div
        className={css({ aspectRatio: "3/4", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "var(--shadows-admin-sm)" })}
        style={{ background: ac.skeleton, border: `1px solid ${ac.border}` }}
      >
        {item.type === "image" && item.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview; next/image needs remotePatterns for the S3 host
          <img src={item.thumb} alt={item.alt} className={css({ width: "100%", height: "100%" })} style={{ objectFit: "contain" }} />
        ) : (
          <Icon name={item.type === "video" ? "play" : "media"} size={28} strokeWidth={1.3} style={{ color: ac.faint }} />
        )}
      </div>

      <div>
        <div className={css({ fontSize: "12.5px", lineHeight: 1.6, wordBreak: "break-all" })} style={{ fontFamily: "ui-monospace, monospace" }}>{item.title}</div>
        <div className={css({ fontSize: "12.5px", marginTop: "6px" })} style={{ color: ac.muted }}>{[item.dims, item.size, item.mime].filter(Boolean).join(" · ")}</div>
      </div>

      <div className={css({ display: "flex", flexDirection: "column", gap: "9px", paddingTop: "16px" })} style={{ borderTop: `1px solid ${ac.rowLine}` }}>
        <DetailRow label="Uploaded by" value={item.authorName || "—"} />
        <DetailRow label="Uploaded" value={item.date} />
      </div>

      {item.type === "image" ? (
        <div>
          <Field label="Alt text" hint="Describes the image for screen readers and for search.">
            <Textarea
              value={alt}
              onChange={(e) => {
                setAlt(e.target.value);
                setAltMsg(null);
              }}
              rows={2}
              placeholder="Describe the image…"
            />
          </Field>
          {altDirty || altMsg ? (
            <div className={css({ display: "flex", alignItems: "center", gap: "10px", marginTop: "9px" })}>
              {altDirty ? (
                <Button variant="primary" size="sm" disabled={savingAlt} onClick={() => void saveAlt()}>
                  {savingAlt ? "Saving…" : "Save alt text"}
                </Button>
              ) : null}
              {altMsg ? (
                <span className={css({ fontSize: "12px" })} style={{ color: altMsg.kind === "err" ? ac.danger : ac.good }}>
                  {altMsg.text}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Not a <Field>: that renders a <label>, and a label wrapping the Copy
          button would forward the click to the input as well. */}
      <div>
        <div className={css({ fontSize: "12.5px", fontWeight: 500, marginBottom: "6px" })} style={{ color: ac.sub }}>
          File URL
        </div>
        <div className={css({ display: "flex", gap: "6px" })}>
          <Input readOnly value={item.url} className={css({ flex: 1, minWidth: 0, fontSize: "11px", fontFamily: "ui-monospace, monospace" })} />
          <Button
            icon="copy"
            className={css({ flex: "none" })}
            onClick={() => {
              navigator.clipboard?.writeText(item.url);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <div className={css({ marginTop: "auto", paddingTop: "16px" })} style={{ borderTop: `1px solid ${ac.rowLine}` }}>
        <Button
          variant="danger"
          icon="trash"
          disabled={deleting}
          className={css({ width: "100%" })}
          onClick={() => {
            setDeleteErr(null);
            setConfirming(true);
          }}
        >
          {deleting ? "Deleting…" : "Delete permanently"}
        </Button>
      </div>

      {confirming ? (
        <ConfirmDialog
          title="Delete this file permanently?"
          confirmLabel="Delete permanently"
          busyLabel="Deleting…"
          busy={deleting}
          error={deleteErr}
          onConfirm={() => void remove()}
          onCancel={() => {
            setConfirming(false);
            setDeleteErr(null);
          }}
        >
          <strong style={{ color: ac.text, fontWeight: 600 }}>{item.title}</strong> is removed from WordPress for
          good. Unlike posts and programs there is no Trash to restore it from, and any article or program still
          using this file loses its image.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={css({ display: "flex", justifyContent: "space-between", gap: "16px", fontSize: "12.5px" })}>
      <span style={{ color: ac.muted, flex: "none" }}>{label}</span>
      <span className={css({ textAlign: "right", minWidth: 0, wordBreak: "break-word" })}>{value}</span>
    </div>
  );
}
