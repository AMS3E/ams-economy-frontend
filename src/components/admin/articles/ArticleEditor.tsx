"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { css, cx } from "@/styled-system/css";
import { ac, type Status } from "../tokens";
import { Icon, type IconName } from "../icons";
import { Dropdown } from "../Dropdown";
import { BentoCard, StatusPill } from "../ui";
import type { EditablePost } from "@/lib/admin/post-edit";
import type { CategoryNode } from "@/lib/admin/categories";
import { savePostAction, createPostAction, type EditorPayload } from "@/lib/admin/actions";
import { searchTags, type TagOption } from "@/lib/admin/editor-actions";
import { createTag } from "@/lib/admin/screen-actions";
import MediaPicker from "../MediaPicker";
import { type BodyEditorHandle } from "./BodyEditor";

// The real Gutenberg canvas — @wordpress/block-editor touches `document` at
// module scope and is far too heavy for the server bundle, so it loads
// client-side only, on the editor screens that actually mount it.
const GutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => <div className={css({ minHeight: "320px" })} />,
});

// ---------------------------------------------------------------------------
// Article editor, wired to WordPress.
//
// SAVES: title, body (Gutenberg → block markup), excerpt, status, categories,
// tags, featured image, Yoast SEO. The body is DIRTY-TRACKED: `content` rides
// the payload only when the user actually edited it here — with Gutenberg a
// save is lossless either way, but an untouched body is still not worth
// rewriting.
//
// Both mode panels stay mounted and toggle via `display` so contentEditable text
// survives the switch; title/excerpt are uncontrolled (init once, read on save
// via ref) because a controlled contentEditable fights the cursor.
// ---------------------------------------------------------------------------

type Mode = "write" | "settings";

const cardTitle = css({ fontSize: "13px", fontWeight: 600 });
const metaLabel = css({ fontSize: "12.5px" });
const rowBetween = css({ display: "flex", alignItems: "center", justifyContent: "space-between" });
const fieldLabel = css({ fontSize: "12px", marginBottom: "7px" });
const textInput = css({ width: "100%", height: "34px", padding: "0 11px", borderRadius: "8px", fontSize: "13px" });
const inputStyle = { background: ac.surface, border: `1px solid ${ac.border}`, color: ac.text } as const;
const editablePlaceholder = css({
  "&:empty::before": { content: "attr(data-placeholder)", color: ac.faint, pointerEvents: "none" },
});

function toWpStatus(s: Status): string {
  return s === "Published" ? "publish" : s === "Pending" ? "pending" : s === "Private" ? "private" : "draft";
}
function fromWpStatus(s: string): Status {
  return s === "publish" ? "Published" : s === "pending" ? "Pending" : s === "private" ? "Private" : "Draft";
}

// Escape plain text for one-time injection into a contentEditable via
// dangerouslySetInnerHTML (init only; React skips the DOM when __html is stable,
// so user edits are preserved across re-renders). Read back with innerText.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function ArticleEditor({
  mode = "edit",
  post = null,
  categories,
}: {
  mode?: "create" | "edit";
  post?: EditablePost | null;
  categories: CategoryNode[];
}) {
  const router = useRouter();
  const isCreate = mode === "create";

  const [view, setView] = useState<Mode>("write");

  // Uncontrolled canvas fields — initialised once via a callback ref (below).
  const titleRef = useRef<HTMLDivElement | null>(null);
  const excerptRef = useRef<HTMLDivElement | null>(null);

  // The body editor registers a handle here once mounted; save() consults it
  // for dirty state + HTML. Stable identity so BodyEditor's effect runs once.
  const bodyRef = useRef<BodyEditorHandle | null>(null);
  const registerBody = useCallback((h: BodyEditorHandle | null) => {
    bodyRef.current = h;
  }, []);

  // Publish
  const [pubStatus, setPubStatus] = useState<Status>(isCreate ? "Draft" : fromWpStatus(post?.status ?? "draft"));
  const [statusOpen, setStatusOpen] = useState(false);
  // Visibility, WordPress's model: public | private (a STATUS) | password
  // protected (a FIELD). Private is therefore driven by pubStatus, not by a
  // separate flag — the two cannot both be authoritative.
  const [password, setPassword] = useState(post?.password ?? "");
  const [sticky, setSticky] = useState(post?.sticky ?? false);
  /** A private post has no password field at all, so protection only exists in
   *  the other statuses. Derived rather than stored — two sources of truth for
   *  one WordPress concept is how the screen ends up lying about the data. */
  const passwordProtected = pubStatus !== "Private" && password.trim().length > 0;
  const [excerptOpen, setExcerptOpen] = useState(false);

  // Organize
  const [checked, setChecked] = useState<Record<number, boolean>>(
    Object.fromEntries((post?.categoryIds ?? []).map((id) => [id, true])),
  );
  const [catSearch, setCatSearch] = useState("");

  // Tags (typeahead-managed) + featured image (media picker)
  const [tags, setTags] = useState<TagOption[]>(post?.tags ?? []);
  const [featuredId, setFeaturedId] = useState(post?.featuredMedia ?? 0);
  const [featuredThumb, setFeaturedThumb] = useState(post?.featuredThumb ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);

  // SEO
  const [seoTitle, setSeoTitle] = useState(post?.seo.title ?? "");
  const [metaDesc, setMetaDesc] = useState(post?.seo.description ?? "");
  const [focusKw, setFocusKw] = useState(post?.seo.focus ?? "");

  // Save feedback
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const selectedCount = Object.values(checked).filter(Boolean).length;
  /** The checked categories, in the tree's own order — shown under the title. */
  const selectedCategories = categories.filter((c) => checked[c.id]);

  /**
   * Where "Preview in new tab" goes. A published post has a real public page on
   * our own site; anything else only exists behind WordPress's preview, which
   * needs a wp-admin session in the same browser (the owner has one). A brand
   * new post has neither, so the control is hidden rather than pointed at a 404.
   */
  const previewHref = isCreate || !post
    ? undefined
    : post.status === "publish" && post.slug
      ? `/article/${post.slug}`
      : `${process.env.NEXT_PUBLIC_WP_ORIGIN ?? "https://infotainment.ams.com.kh"}/?p=${post.id}&preview=true`;

  // Group the flat, depth-ordered tree into top-level branches for the columns.
  const groups: CategoryNode[][] = [];
  for (const c of categories) {
    if (c.depth === 0) groups.push([c]);
    else groups[groups.length - 1]?.push(c);
  }
  const filteredCats = catSearch.trim()
    ? categories.filter((c) => c.name.includes(catSearch.trim()))
    : null;

  async function save(target?: Status) {
    const status = toWpStatus(target ?? pubStatus);
    const payload: EditorPayload = {
      title: (titleRef.current?.innerText ?? "").trim(),
      excerpt: (excerptRef.current?.innerText ?? "").trim(),
      status,
      categories: Object.entries(checked).filter(([, v]) => v).map(([id]) => Number(id)),
      // For scoped cache revalidation on publish (see refreshPublic).
      categorySlugs: categories.filter((c) => checked[c.id]).map((c) => c.slug),
      tags: tags.map((t) => t.id),
      featuredMedia: featuredId,
      // A private post cannot also be password-protected in WordPress, so the
      // password is dropped rather than sent alongside — sending both makes
      // WordPress silently keep one and the screen would then be lying.
      password: pubStatus === "Private" ? "" : password.trim(),
      // MEASURED, not assumed: WordPress REJECTS the whole write with
      // `rest_invalid_field` ("A post can not be sticky and have a password")
      // when both are set — a 400 that loses every other edit in the payload.
      // The checkbox is disabled in that state; this is the belt to its braces.
      sticky: passwordProtected ? false : sticky,
      seo: { title: seoTitle, description: metaDesc, focus: focusKw },
    };
    // Only a body the user actually edited is sent — an untouched (Gutenberg)
    // body must never round-trip through the editor's HTML serializer.
    if (bodyRef.current?.isDirty()) payload.content = bodyRef.current.getHtml();

    if (!payload.title) {
      setSaveMsg({ kind: "err", text: "Give the article a title first." });
      return;
    }

    setSaving(true);
    setSaveMsg(null);
    const res = isCreate ? await createPostAction(payload) : await savePostAction(post!.id, payload);
    setSaving(false);

    if (!res.ok) {
      setSaveMsg({ kind: "err", text: res.error ?? "Save failed." });
      return;
    }
    if (target) setPubStatus(target);
    else if (res.status) setPubStatus(fromWpStatus(res.status));
    setSaveMsg({ kind: "ok", text: "Saved" });
    if (isCreate && res.id) router.push(`/admin/articles/${res.id}`);
  }

  return (
    <div className={css({ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 })}>
      {/* ---- Top bar --------------------------------------------------- */}
      <div
        className={css({ display: "flex", alignItems: "center", gap: "12px", padding: "0 20px", height: "56px", flex: "none", position: "sticky", top: 0, zIndex: 30 })}
        style={{ background: ac.surface, borderBottom: `1px solid ${ac.border}` }}
      >
        <Link href="/admin/articles" className={css({ width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none", _hover: { background: ac.surfaceHover } })} style={{ color: ac.muted }}>
          <Icon name="back" size={16} strokeWidth={1.8} />
        </Link>
        <StatusPill status={pubStatus} />
        <span className={css({ fontSize: "12.5px", whiteSpace: "nowrap" })} style={{ color: saveMsg?.kind === "err" ? ac.danger : ac.faint }}>
          {saving ? "Saving…" : saveMsg ? saveMsg.text : isCreate ? "New article · not saved yet" : "Loaded"}
        </span>

        <div className={css({ flex: 1 })} />
        <Segmented mode={view} onChange={setView} />
        <div className={css({ flex: 1 })} />

        <button
          type="button"
          disabled={saving}
          onClick={() => save("Draft")}
          className={css({ height: "34px", padding: "0 14px", borderRadius: "8px", fontSize: "13px", cursor: "pointer", flex: "none", _hover: { background: ac.surfaceHover } })}
          style={{ background: ac.surface, border: `1px solid ${ac.border}`, color: ac.text, opacity: saving ? 0.6 : 1 }}
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => save("Published")}
          className={css({ height: "34px", padding: "0 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: "none", color: "#fff", flex: "none", transition: "background .12s", _hover: { background: ac.accentHover } })}
          style={{ background: ac.accent, opacity: saving ? 0.7 : 1 }}
        >
          {pubStatus === "Published" && !isCreate ? "Update" : "Publish"}
        </button>
      </div>

      {/* ---- WRITE canvas ---------------------------------------------
          The editor owns this view's LAYOUT now (band across the top, canvas
          area + docked inspector below), so the document's own chrome — cover,
          title, excerpt — is handed to it as slots. It still lives here, and
          its refs are still read by save(); only where it renders changed. */}
      <div style={{ display: view === "write" ? "block" : "none" }}>
        <GutenbergEditor
          initialContent={isCreate ? "" : post?.bodyRaw ?? ""}
          register={registerBody}
          previewHref={previewHref}
          header={
            <>
              {/* Cover (featured image) — click to pick/replace via the media dialog */}
              {featuredThumb ? (
                <button type="button" onClick={() => setPickerOpen(true)} className={css({ display: "block", width: "100%", padding: 0, border: "none", background: "transparent", cursor: "pointer", position: "relative", borderRadius: "10px", overflow: "hidden", "&:hover [data-cover-hint]": { opacity: 1 } })}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview; next/image would need remotePatterns for the S3 host */}
                  <img
                    src={featuredThumb}
                    alt=""
                    className={css({ width: "100%", display: "block" })}
                    style={{ maxHeight: 320, objectFit: "cover", border: `1px solid ${ac.border}`, borderRadius: 10 }}
                  />
                  <span data-cover-hint className={css({ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600, color: "#fff", opacity: 0, transition: "opacity .15s" })} style={{ background: ac.overlay }}>
                    Replace cover image
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className={css({ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%", height: "64px", borderRadius: "10px", cursor: "pointer", background: "transparent", transition: "border-color .12s, color .12s", _hover: { borderColor: ac.borderStrong, color: ac.text } })}
                  style={{ border: `1.5px dashed ${ac.borderStrong}`, color: ac.faint }}
                >
                  <Icon name="media" size={16} strokeWidth={1.7} />
                  <span className={css({ fontSize: "13px" })}>No cover image · choose or upload one</span>
                </button>
              )}
              {pickerOpen ? (
                <MediaPicker
                  title="Cover image"
                  onClose={() => setPickerOpen(false)}
                  onPick={(m) => {
                    setFeaturedId(m.id);
                    setFeaturedThumb(m.thumb);
                    setPickerOpen(false);
                  }}
                />
              ) : null}

              {/* Title (editable) — init once via dangerouslySetInnerHTML, read on save */}
              <div
                ref={titleRef}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Article title"
                dangerouslySetInnerHTML={{ __html: escapeHtml(post?.title ?? "") }}
                // Focus fill is SUNKEN, not `surface`: the title now sits on the
                // document sheet, which is #FFFFFF in light mode — so a white
                // fill was a no-op there and the focus state lost half its
                // signal. Sunken reads as a recessed field on both sheets.
                className={cx(editablePlaceholder, css({ fontSize: "32px", fontWeight: 600, lineHeight: 1.55, letterSpacing: "-0.01em", marginTop: "28px", padding: "6px 12px", marginX: "-12px", borderRadius: "8px", cursor: "text", _focus: { outline: "none", background: ac.surfaceSunken, boxShadow: `inset 0 0 0 1px ${ac.border}` } }))}
              />

              {/* The article's categories, where the "BODY · saved only if you
                  edit it here" note used to be. That note explained an
                  implementation detail (body writes are dirty-tracked) to
                  someone who did not ask; this is the article's own metadata,
                  which is what a writer wants under a headline. Editing them is
                  still the Settings view's job — this is a readout, and it
                  renders nothing at all when the article has no categories. */}
              {selectedCategories.length > 0 ? (
                <div className={css({ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "20px", marginBottom: "18px" })}>
                  {selectedCategories.map((c) => (
                    <span
                      key={c.id}
                      className={css({ fontSize: "11.5px", fontWeight: 600, padding: "3px 9px", borderRadius: "99px", whiteSpace: "nowrap" })}
                      style={{ color: ac.muted, background: ac.canvas, border: `1px solid ${ac.border}` }}
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              ) : (
                <div className={css({ marginTop: "20px", marginBottom: "18px" })} />
              )}
            </>
          }
          footer={
            /* Excerpt (editable) — stays mounted so its ref/content survive the toggle */
            <div className={css({ marginTop: "28px", paddingTop: "16px" })} style={{ borderTop: `1px solid ${ac.border}` }}>
              <button type="button" onClick={() => setExcerptOpen((v) => !v)} className={css({ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, border: "none", background: "transparent" })} style={{ color: ac.muted }}>
                <Icon name="chevronRight" size={12} strokeWidth={2} style={{ transform: excerptOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                Excerpt
              </button>
              <div style={{ display: excerptOpen ? "block" : "none" }}>
                <div
                  ref={excerptRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Optional summary shown in listings…"
                  dangerouslySetInnerHTML={{ __html: escapeHtml(post?.excerpt ?? "") }}
                  className={cx(editablePlaceholder, css({ marginTop: "12px", fontSize: "14px", lineHeight: 1.9, borderRadius: "8px", padding: "12px 14px", minHeight: "60px", cursor: "text", _focus: { outline: "none" } }))}
                  style={{ background: ac.surface, border: `1px solid ${ac.border}`, color: ac.sub }}
                />
              </div>
            </div>
          }
        />
      </div>

      {/* ---- SETTINGS bento ------------------------------------------- */}
      <div style={{ display: view === "settings" ? "block" : "none" }}>
        <div className={css({ padding: "30px 40px 72px", maxWidth: "1440px" })}>
          <div className={css({ display: "flex", gap: "16px", alignItems: "flex-start" })}>
            {/* Left rail — Publish + SEO */}
            <div className={css({ flex: "1", minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" })}>
              <BentoCard style={{ padding: "20px 22px" }}>
                <div className={cardTitle}>Publish</div>
                <div className={css({ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" })}>
                  <div className={rowBetween}>
                    <span className={metaLabel} style={{ color: ac.muted }}>Status</span>
                    <Dropdown
                      label={pubStatus === "Pending" ? "Pending review" : pubStatus}
                      hasValue
                      open={statusOpen}
                      onToggle={() => setStatusOpen((v) => !v)}
                      onClose={() => setStatusOpen(false)}
                      options={[
                        { label: "Draft", value: "Draft" },
                        { label: "Pending review", value: "Pending" },
                        { label: "Private", value: "Private" },
                        { label: "Published", value: "Published" },
                      ]}
                      selected={pubStatus}
                      onSelect={(v) => setPubStatus(v as Status)}
                      align="right"
                      minWidth={160}
                    />
                  </div>

                  {/* NO "Scheduled". WordPress has `future`, this server cannot
                      honour it: the site's loopback is broken, so WP-Cron never
                      fires and a scheduled post stays scheduled forever. The
                      note is in the UI because the absence is deliberate and
                      the next person will otherwise "fix" it. */}
                  <p className={css({ fontSize: "11.5px", lineHeight: 1.6 })} style={{ color: ac.faint }}>
                    Scheduling is unavailable — this server&rsquo;s cron is broken, so a scheduled post would never publish. Publish when it is ready.
                  </p>

                  <div style={{ height: 1, background: ac.rowLine, margin: "2px 0" }} />

                  <div className={rowBetween}>
                    <span className={metaLabel} style={{ color: ac.muted }}>Visibility</span>
                    <span className={css({ fontSize: "12.5px", fontWeight: 600 })}>
                      {pubStatus === "Private" ? "Private" : passwordProtected ? "Password protected" : "Public"}
                    </span>
                  </div>

                  {pubStatus === "Private" ? (
                    <p className={css({ fontSize: "11.5px", lineHeight: 1.6 })} style={{ color: ac.faint }}>
                      Visible to editors and admins only. A private post cannot also carry a password.
                    </p>
                  ) : (
                    <div>
                      <div className={fieldLabel} style={{ color: ac.muted }}>Password (optional)</div>
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Leave empty for a public post"
                        className={textInput}
                        style={inputStyle}
                      />
                    </div>
                  )}

                  <label className={css({ display: "flex", alignItems: "center", gap: "9px", cursor: passwordProtected ? "default" : "pointer" })}>
                    <input
                      type="checkbox"
                      checked={sticky && !passwordProtected}
                      disabled={passwordProtected}
                      onChange={(e) => setSticky(e.target.checked)}
                    />
                    <span className={metaLabel} style={{ color: passwordProtected ? ac.faint : ac.muted }}>
                      Stick to the top of WordPress&rsquo;s own archives
                    </span>
                  </label>
                  {passwordProtected && sticky ? (
                    // WordPress refuses the pair outright (rest_invalid_field),
                    // and a rejected write loses every other edit in the same
                    // save — so say it here rather than let the save 400.
                    <p className={css({ fontSize: "11.5px", lineHeight: 1.6 })} style={{ color: ac.faint }}>
                      WordPress won&rsquo;t allow a sticky post to have a password — sticky is off while one is set.
                    </p>
                  ) : null}
                  <div style={{ height: 1, background: ac.rowLine, margin: "2px 0" }} />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => save()}
                    className={css({ height: "36px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: "none", color: "#fff", transition: "background .12s", _hover: { background: ac.accentHover } })}
                    style={{ background: ac.accent, opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? "Saving…" : `Save as ${pubStatus === "Pending" ? "pending review" : pubStatus.toLowerCase()}`}
                  </button>
                </div>
              </BentoCard>

              <BentoCard style={{ padding: "20px 22px" }}>
                <div className={cardTitle}>SEO</div>
                <div className={css({ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" })}>
                  <div>
                    <div className={rowBetween} style={{ marginBottom: 7 }}>
                      <span className={css({ fontSize: "12px" })} style={{ color: ac.muted }}>SEO title</span>
                      <Counter len={seoTitle.length} max={60} />
                    </div>
                    <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Defaults to the title" className={textInput} style={inputStyle} />
                  </div>
                  <div>
                    <div className={rowBetween} style={{ marginBottom: 7 }}>
                      <span className={css({ fontSize: "12px" })} style={{ color: ac.muted }}>Meta description</span>
                      <Counter len={metaDesc.length} max={160} />
                    </div>
                    <textarea value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} rows={3} placeholder="Defaults to the excerpt" className={css({ width: "100%", padding: "9px 11px", borderRadius: "8px", fontSize: "13px", lineHeight: 1.7, resize: "vertical" })} style={inputStyle} />
                  </div>
                  <div>
                    <div className={fieldLabel} style={{ color: ac.muted }}>Focus keyphrase</div>
                    <input value={focusKw} onChange={(e) => setFocusKw(e.target.value)} placeholder="e.g. Angelina Jolie កម្ពុជា" className={textInput} style={inputStyle} />
                  </div>
                </div>
              </BentoCard>
            </div>

            {/* Right area — Categories + Tags */}
            <div className={css({ flex: "2", minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" })}>
              <BentoCard style={{ padding: "20px 22px" }}>
                <div className={rowBetween}>
                  <div className={cardTitle}>Categories</div>
                  <span className={css({ fontSize: "12px" })} style={{ color: selectedCount ? ac.data : ac.faint }}>
                    {selectedCount} selected
                  </span>
                </div>
                <div className={css({ position: "relative", marginTop: "14px" })}>
                  <Icon name="search" size={14} style={{ position: "absolute", left: 11, top: 10, color: ac.faint }} />
                  <input value={catSearch} onChange={(e) => setCatSearch(e.target.value)} placeholder={`Filter ${categories.length} categories…`} className={css({ width: "100%", height: "34px", padding: "0 11px 0 34px", borderRadius: "8px", fontSize: "13px" })} style={inputStyle} />
                </div>

                {filteredCats ? (
                  <div className={css({ marginTop: "14px", display: "flex", flexDirection: "column", gap: "1px" })}>
                    {filteredCats.length === 0 ? (
                      <div className={css({ fontSize: "13px", padding: "10px 4px" })} style={{ color: ac.muted }}>No categories match “{catSearch}”.</div>
                    ) : filteredCats.map((c) => (
                      <CatRow key={c.id} c={c} indent={false} checked={!!checked[c.id]} onToggle={() => setChecked((s) => ({ ...s, [c.id]: !s[c.id] }))} />
                    ))}
                  </div>
                ) : (
                  <div className={css({ marginTop: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "20px 28px" })}>
                    {groups.map((group) => (
                      <div key={group[0].id} className={css({ display: "flex", flexDirection: "column", gap: "1px" })}>
                        {group.map((c) => (
                          <CatRow key={c.id} c={c} indent checked={!!checked[c.id]} onToggle={() => setChecked((s) => ({ ...s, [c.id]: !s[c.id] }))} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </BentoCard>

              <TagsEditor tags={tags} onChange={setTags} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- tags ------------------------------------------------------------------

// Typeahead over the ~5.5k post tags: debounced server search (most-used
// first), chips for the selected set, and create-on-demand for a name with no
// match. Only the selected ids leave this component — the save payload sends
// term ids, never names.
function TagsEditor({ tags, onChange }: { tags: TagOption[]; onChange: (t: TagOption[]) => void }) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<TagOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = input.trim();
  const has = (id: number) => tags.some((t) => t.id === id);

  // State updates only inside the timer callback, never synchronously in the
  // effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    let stale = false;
    const t = setTimeout(async () => {
      if (!q) {
        setOptions([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      // Degrade to "no suggestions" if the action itself throws.
      const found = await searchTags(q).catch(() => []);
      if (stale) return;
      setOptions(found);
      setSearching(false);
    }, q ? 300 : 0);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);

  const add = (t: TagOption) => {
    if (!has(t.id)) onChange([...tags, t]);
    setInput("");
    setOptions([]);
  };

  const createAndAdd = async () => {
    if (!q || creating) return;
    setCreating(true);
    setError(null);
    const res = await createTag(q);
    setCreating(false);
    if (!res.ok || !res.id) {
      // WP answers "term exists" for an exact duplicate — surface whatever it said.
      setError(res.error ?? "Couldn't create the tag.");
      return;
    }
    add({ id: res.id, name: q });
  };

  const exactMatch = options.find((o) => o.name.toLowerCase() === q.toLowerCase());

  return (
    <BentoCard style={{ padding: "20px 22px" }}>
      <div className={rowBetween}>
        <div className={cardTitle}>Tags</div>
        <span className={css({ fontSize: "12px" })} style={{ color: tags.length ? ac.data : ac.faint }}>
          {tags.length} selected
        </span>
      </div>

      {tags.length ? (
        <div className={css({ display: "flex", flexWrap: "wrap", gap: "7px", marginTop: "14px" })}>
          {tags.map((t) => (
            <span key={t.id} className={css({ height: "27px", padding: "0 6px 0 11px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "99px", fontSize: "12.5px" })} style={{ background: ac.surfaceSunken, color: ac.text }}>
              {t.name}
              <button type="button" onClick={() => onChange(tags.filter((x) => x.id !== t.id))} aria-label={`Remove tag ${t.name}`} className={css({ width: "16px", height: "16px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none", background: "transparent", _hover: { background: ac.border } })} style={{ color: ac.muted }}>
                <Icon name="x" size={9} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className={css({ position: "relative", marginTop: "14px" })}>
        <Icon name="search" size={14} style={{ position: "absolute", left: 11, top: 10, color: ac.faint }} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (exactMatch) add(exactMatch);
            else void createAndAdd();
          }}
          placeholder="Search tags, or type a new one and press Enter…"
          className={css({ width: "100%", height: "34px", padding: "0 11px 0 34px", borderRadius: "8px", fontSize: "13px" })}
          style={{ background: ac.surface, border: `1px solid ${ac.border}`, color: ac.text }}
        />

        {q ? (
          <div className={css({ position: "absolute", top: "38px", left: 0, right: 0, zIndex: 20, borderRadius: "10px", overflow: "hidden", maxHeight: "260px", overflowY: "auto" })} style={{ background: ac.surface, border: `1px solid ${ac.border}`, boxShadow: ac.shadowMd }}>
            {options
              .filter((o) => !has(o.id))
              .map((o) => (
                <button key={o.id} type="button" onClick={() => add(o)} className={css({ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: "13px", cursor: "pointer", border: "none", background: "transparent", _hover: { background: ac.surfaceHover } })}>
                  {o.name}
                </button>
              ))}
            {!exactMatch ? (
              <button type="button" disabled={creating} onClick={() => void createAndAdd()} className={css({ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: "13px", cursor: "pointer", border: "none", background: "transparent", fontWeight: 600, _hover: { background: ac.surfaceHover } })} style={{ color: ac.accent, borderTop: options.length ? `1px solid ${ac.rowLine}` : "none" }}>
                {creating ? "Creating…" : `Create “${q}”`}
              </button>
            ) : null}
            {searching && options.length === 0 ? (
              <div className={css({ padding: "8px 12px", fontSize: "12.5px" })} style={{ color: ac.faint }}>Searching…</div>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className={css({ fontSize: "12.5px", marginTop: "10px" })} style={{ color: ac.danger }}>{error}</p>
      ) : null}
    </BentoCard>
  );
}

// --- small pieces ----------------------------------------------------------

function Segmented({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const items: { key: Mode; label: string; icon: IconName }[] = [
    { key: "write", label: "Write", icon: "pencil" },
    { key: "settings", label: "Settings", icon: "settings" },
  ];
  return (
    <div className={css({ display: "flex", gap: "2px", padding: "3px", borderRadius: "9px", flex: "none" })} style={{ background: ac.surfaceSunken }}>
      {items.map((it) => {
        const on = mode === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={css({ display: "flex", alignItems: "center", gap: "6px", height: "28px", padding: "0 13px", borderRadius: "7px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", border: "none", transition: "background .15s, box-shadow .15s, color .15s" })}
            style={on ? { background: ac.surface, color: ac.text, boxShadow: ac.shadowSm } : { background: "transparent", color: ac.muted }}
          >
            <Icon name={it.icon} size={13} strokeWidth={1.8} />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function CatRow({ c, checked, onToggle, indent }: { c: CategoryNode; checked: boolean; onToggle: () => void; indent: boolean }) {
  return (
    <label
      className={css({ display: "flex", alignItems: "center", gap: "9px", padding: "5px 8px", borderRadius: "6px", cursor: "pointer", _hover: { background: ac.surfaceHover } })}
      style={{ paddingLeft: 8 + (indent ? c.depth * 16 : 0) }}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className={css({ width: "15px", height: "15px", margin: 0, flex: "none", cursor: "pointer" })} style={{ accentColor: ac.text }} />
      <span className={css({ fontSize: "13.5px", lineHeight: 1.6 })} style={{ fontWeight: c.depth === 0 ? 600 : 400 }}>{c.name}</span>
      <span className={css({ fontSize: "11.5px", fontVariantNumeric: "tabular-nums", marginLeft: "auto" })} style={{ color: ac.faint }}>{c.count.toLocaleString("en-US")}</span>
    </label>
  );
}

function Counter({ len, max }: { len: number; max: number }) {
  const over = len > max;
  return (
    <span className={css({ fontSize: "11px", fontVariantNumeric: "tabular-nums" })} style={{ color: over ? ac.warn : ac.faint }}>
      {len} / {max}
    </span>
  );
}

