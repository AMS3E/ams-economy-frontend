"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parse, serialize, type Block } from "@wordpress/blocks";
import { registerCoreBlocks } from "@wordpress/block-library";
import {
  BlockEditorProvider,
  BlockInspector,
  BlockList,
  BlockTools,
  ObserveTyping,
  WritingFlow,
  // wp-admin's own full inserter panel — Blocks / Patterns / Media, every
  // allowed block, with categories. `Inserter` (the popover) only ever showed
  // the six-block quick list.
  __experimentalLibrary as InserterLibrary,
} from "@wordpress/block-editor";
import { SlotFillProvider, Popover } from "@wordpress/components";
import { useDispatch } from "@wordpress/data";
import { ShortcutProvider } from "@wordpress/keyboard-shortcuts";
// Side-effect import: this is what registers the core text formats (bold,
// italic, link, inline code, …). Without it the block toolbar renders with no
// formatting controls at all.
import "@wordpress/format-library";
// WordPress's own editor stylesheets. They ship with the packages, so the
// canvas, toolbar and inserter look like wp-admin without us restyling them.
// Scoped to this chunk: the component is dynamically imported client-side, so
// pages that never open the editor never download them.
import "@wordpress/components/build-style/style.css";
import "@wordpress/block-editor/build-style/style.css";
import "@wordpress/block-editor/build-style/content.css";
import "@wordpress/block-library/build-style/style.css";
import "@wordpress/block-library/build-style/editor.css";
// (@wordpress/format-library's stylesheet is NOT importable — its package
// `exports` map omits ./build-style/*, unlike block-library's. The file is on
// disk but unreachable, and the formatting controls work without it; only the
// link popover loses a little of wp-admin's polish.)
//
// LAST, so it wins on order: our overrides for the stylesheets above. It has to
// be a plain .css file rather than Panda — Panda emits into @layer utilities and
// unlayered WordPress rules beat layered ones outright. See the file's header.
import "./gutenberg-overrides.css";
import { css, cx } from "@/styled-system/css";
import { ac, publishedPageBg } from "../tokens";
import { Icon, type IconName } from "../icons";
import { amsMediaUpload, ensureMediaUploadBridge } from "./media-upload-bridge";
import type { BodyEditorHandle } from "./BodyEditor";

// THE REAL GUTENBERG, not an imitation of it. @wordpress/block-editor is the
// same package wp-admin runs, so the canvas, the block toolbar, the slash
// inserter, drag handles and keyboard shortcuts behave exactly as the editors
// already know them — which is the whole point: no retraining.
//
// Why this replaces TipTap: TipTap round-tripped block markup as FLAT HTML.
// 1,999 of the newest 2,000 posts on this site are block markup, so every body
// save through TipTap silently destroyed the block structure of the post it
// touched (hence its dirty-tracking guard — the damage was real enough to need
// a guard). Gutenberg parses the stored markup INTO blocks and serializes
// blocks BACK to markup.
//
// MEASURED on 20 real production posts (verify-roundtrip2.mjs), because
// "lossless" deserved a number rather than a promise:
//   - 20/20 parse with EVERY block valid — nobody opens a post to find
//     "this block contains unexpected or invalid content".
//   - 19/20 serialize back identical or differing only in insignificant
//     whitespace (`" />` becomes `"/>`).
//   - 1/20 differs structurally in one spot: a doubled space became `&nbsp;`.
//     That is RichText doing exactly what wp-admin does with a double space,
//     not a defect here.
//   - 0/20 unstable: a second round trip changes nothing further, so repeated
//     saves don't churn the markup.
// Body writes stay dirty-tracked anyway, so a metadata-only save still sends
// no `content` at all and cannot touch the stored bytes.
//
// What does NOT come along: third-party blocks registered by WP plugins
// (Slider Revolution, Yoast's internal blocks, WPForms). Their markup survives
// a round trip untouched — it parses as `core/missing`, which serializes back
// byte-for-byte — but it renders as a "this block isn't available" placeholder
// rather than its real UI. Editing THOSE posts' special blocks still belongs
// in wp-admin. Core blocks are the vocabulary news copy actually uses.

/** Blocks the newsroom needs, in the order the inserter should offer them.
 *  Registering all of core would surface a hundred blocks nobody uses here
 *  (query loops, site title, navigation…) and make the inserter noise. */
const ALLOWED_BLOCKS = [
  "core/paragraph",
  "core/heading",
  "core/image",
  "core/list",
  "core/list-item",
  "core/quote",
  "core/embed",
  "core/video",
  "core/audio",
  "core/gallery",
  "core/table",
  "core/separator",
  "core/spacer",
  "core/columns",
  "core/column",
  "core/group",
  "core/html",
  "core/buttons",
  "core/button",
  "core/pullquote",
  "core/file",
  "core/preformatted",
  "core/code",
  // Whatever a plugin wrote and we can't render: keep it intact rather than
  // dropping it on save.
  "core/missing",
  "core/freeform",
];

// registerCoreBlocks() mutates a module-level registry, so it must run exactly
// once per page load — twice and every block logs a duplicate-registration
// warning and the second registration wins.
let blocksRegistered = false;
/**
 * Clicking the canvas OUTSIDE any block clears the selection — which is what
 * makes the floating block toolbar go away. Without it the toolbar stays up
 * and the block stays selected until you happen to click a different block
 * (measured: clicking below the last block and in the side margin both left
 * the selection and the toolbar in place).
 *
 * @wordpress/block-editor has `useBlockSelectionClearer` for exactly this, but
 * it is INTERNAL — not re-exported from the package root, only imported by
 * block-list and block-canvas — so this is the same behaviour written out.
 *
 * It MUST be a child of BlockEditorProvider: the provider stands up its own
 * registry, so a dispatch resolved in the parent component would target a
 * different store instance and silently do nothing.
 */
function CanvasSelectionClearer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // Addressed by store NAME rather than the `store` object: @wordpress/
  // block-editor exports that object at runtime but does not declare it in
  // its types, and the string is the documented equivalent.
  const { clearSelectedBlock } = useDispatch("core/block-editor") as {
    clearSelectedBlock: () => void;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    // Inside a block, or inside WP's own floating UI — a click on the toolbar,
    // a popover or the inserter is still "working on this block".
    if (t.closest(".block-editor-block-list__block")) return;
    if (t.closest(".components-popover, .block-editor-block-contextual-toolbar, .block-editor-inserter")) return;
    clearSelectedBlock();
  };

  // mousedown rather than click: it runs before focus moves, so the toolbar
  // goes away on the press instead of blinking through the release.
  return (
    <div className={className} onMouseDown={onMouseDown}>
      {children}
    </div>
  );
}

function ensureBlocks() {
  if (blocksRegistered) return;
  registerCoreBlocks();
  // Before the first render, not in an effect: withFilters resolves the
  // component at render time, so a late registration leaves already-mounted
  // "Media Library" buttons rendering null.
  ensureMediaUploadBridge();
  blocksRegistered = true;
  // DEV ONLY: lets the round-trip harness call parse/serialize with the real
  // registry loaded, which is the only way to prove that opening a post and
  // saving it returns the stored bytes unchanged. Stripped in production.
  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __amsBlocks?: unknown }).__amsBlocks = { parse, serialize };
  }
}

export default function GutenbergEditor({
  initialContent,
  register,
  previewHref,
  header,
  footer,
}: {
  /** The post's STORED body — `content.raw`, i.e. block markup. Empty for a
   *  new post. (Never content.rendered: that is do_blocks() output, and
   *  parsing it would turn every block into loose HTML.) */
  initialContent: string;
  register: (h: BodyEditorHandle | null) => void;
  /** Where "Preview in new tab" goes. Absent (a post with no URL yet) hides
   *  the control rather than opening something that 404s. */
  previewHref?: string;
  /** The document's own chrome, rendered INSIDE the canvas column: cover image
   *  and title above the blocks, excerpt below. They belong to ArticleEditor
   *  (which owns their refs and reads them on save) and are passed in rather
   *  than moved, because the canvas column is the only place they can live now
   *  that the inspector docks beside it. */
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  ensureBlocks();

  const [blocks, setBlocks] = useState<Block[]>(() => (initialContent ? parse(initialContent) : []));
  const [showInspector, setShowInspector] = useState(false);
  const [inserterOpen, setInserterOpen] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const dirtyRef = useRef(false);

  /* ---- undo / redo ------------------------------------------------------
   *
   * Our own history, because there isn't one to borrow: undo/redo in wp-admin
   * comes from the EDITOR store (core/editor + core-data's undo manager), and
   * a bare BlockEditorProvider has none. We own the blocks array, so the
   * history is a pair of stacks over it.
   *
   * Snapshots on onChange (persistent edits: insert, delete, move, reorder)
   * and NOT on onInput (typing), which is the same granularity wp-admin's
   * persistent undo has — one press should not walk back a character at a
   * time. Cmd+Z is deliberately NOT bound: RichText already handles native
   * undo inside a field, and hijacking the key would break typing undo. */
  const historyRef = useRef<{ past: Block[][]; future: Block[][] }>({ past: [], future: [] });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const HISTORY_LIMIT = 50;

  const commit = (next: Block[], previous: Block[]) => {
    const h = historyRef.current;
    h.past.push(previous);
    if (h.past.length > HISTORY_LIMIT) h.past.shift();
    h.future = [];
    setCanUndo(true);
    setCanRedo(false);
    dirtyRef.current = true;
    setBlocks(next);
  };

  const undo = () => {
    const h = historyRef.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(blocks);
    setCanUndo(h.past.length > 0);
    setCanRedo(true);
    dirtyRef.current = true;
    setBlocks(prev);
  };

  const redo = () => {
    const h = historyRef.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(blocks);
    setCanUndo(true);
    setCanRedo(h.future.length > 0);
    dirtyRef.current = true;
    setBlocks(next);
  };
  // Serialization is the save payload, so it must read the LATEST blocks —
  // register() runs once with a stable handle, so it reads through a ref.
  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const settings = useMemo(
    () => ({
      // FLOATING, as wp-admin does: the toolbar belongs over the block it acts
      // on. It was docked (`hasFixedToolbar: true`) because in the old cramped
      // layout the floating one overlapped our sticky bar and swallowed its
      // clicks — that finding was made against a 704px column with a wrapping
      // 108px bar, and does not survive the new layout. The band now sits above
      // WP's popover layer (see bandClass) so it keeps its clicks either way.
      //
      // Docking it also cost the DRAG HANDLE: with a fixed toolbar the handle
      // lives in it, and `hideDragHandle` removed it — which is exactly why
      // paragraphs and headings could not be dragged while images (natively
      // draggable) could.
      hasFixedToolbar: false,
      focusMode: false,
      allowedBlockTypes: ALLOWED_BLOCKS,
      // MediaUploadCheck gates on this ONE value (…/media-upload/check.cjs):
      // while it was undefined, every block's Upload *and* Media Library
      // buttons were suppressed together — which is why the Image block only
      // offered "Insert from URL". Uploads go through our route handler; the
      // library button opens our picker via the editor.MediaUpload filter.
      // Both halves live in media-upload-bridge.tsx.
      mediaUpload: amsMediaUpload,
      canLockBlocks: false,
      // THIS is what puts "Browse all" under the canvas's quick inserter. Read
      // the source, not the docs: QuickInserter renders that button only when
      // `settings.__experimentalSetIsInserterOpened` exists, because the button
      // has nothing to open otherwise — the host owns the full inserter panel.
      // Ours is the left panel below. Edit-site calls this with an OBJECT
      // (rootClientId/insertionIndex), so coerce rather than store the value.
      __experimentalSetIsInserterOpened: (v: unknown) => setInserterOpen(!!v),
    }),
    [],
  );

  useEffect(() => {
    const handle: BodyEditorHandle = {
      // serialize() emits canonical block markup — the same bytes wp-admin
      // would write for the same document.
      getHtml: () => (blocksRef.current.length ? serialize(blocksRef.current) : ""),
      isDirty: () => dirtyRef.current,
    };
    register(handle);
    // DEV ONLY: the same handle, reachable from a test harness. It is the only
    // way to assert what a save WOULD write without writing it — the editor DOM
    // is not the save payload (an image block carries its attachment id in the
    // serialized markup, never in the rendered <img> class). Stripped in prod.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __amsEditor?: BodyEditorHandle }).__amsEditor = handle;
    }
    return () => register(null);
  }, [register]);

  return (
    <div className={css({ position: "relative" })}>
      {/* One provider around EVERYTHING that reads block state: the docked
          toolbar, the canvas and the inspector all subscribe to the same
          store, so none of them can sit outside it. */}
      <ShortcutProvider>
        <SlotFillProvider>
          <BlockEditorProvider
            value={blocks}
            settings={settings}
            // onInput = in-progress edits (typing): no history entry.
            onInput={(next: Block[]) => {
              dirtyRef.current = true;
              setBlocks(next);
            }}
            // onChange = persistent edits (insert, remove, move, reorder):
            // one undo step each.
            onChange={(next: Block[]) => commit(next, blocks)}
          >
            {/* ONE band, spanning the whole editor above both columns — the
                anatomy wp-admin uses. It is fixed-height and never wraps: the
                old version mixed 30px controls with WP's 40px toolbar buttons
                inside a wrapping row, which measured 44px empty and 108px with
                a block selected (three rows of misaligned icons). */}
            <div className={cx("ams-editor-band", bandClass)} style={{ background: ac.surface, borderBottom: `1px solid ${ac.border}` }}>
              {/* Opens the FULL panel, as wp-admin's header + does. It used to
                  open WP's quick-inserter popover, which shows six blocks and
                  no way to reach the rest — the "Browse all" button that would
                  have led there cannot render without the host providing a
                  panel (see __experimentalSetIsInserterOpened above). */}
              <button
                type="button"
                onClick={() => setInserterOpen((v) => !v)}
                aria-expanded={inserterOpen}
                aria-label="Add block"
                title="Add block"
                className={css({ display: "flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", flex: "none", borderRadius: "8px", cursor: "pointer", border: "none", color: "#fff", transition: "transform .12s" })}
                style={{ background: ac.accent, transform: inserterOpen ? "rotate(45deg)" : "none" }}
              >
                <Icon name="plus" size={16} strokeWidth={2.2} />
              </button>
              <span className={dividerClass} style={{ background: ac.border }} />

              {/* Undo / redo, where wp-admin puts them. The block's own controls
                  are NOT here any more — they float over the block they act on
                  (see settings.hasFixedToolbar), which is also what gives text
                  blocks their drag handle back. */}
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                aria-label="Undo"
                title="Undo"
                className={bandIconBtnClass}
                style={{ color: canUndo ? ac.text : ac.faint, cursor: canUndo ? "pointer" : "default" }}
              >
                <Icon name="undo" size={17} strokeWidth={1.9} />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                aria-label="Redo"
                title="Redo"
                className={bandIconBtnClass}
                style={{ color: canRedo ? ac.text : ac.faint, cursor: canRedo ? "pointer" : "default" }}
              >
                <Icon name="redo" size={17} strokeWidth={1.9} />
              </button>

              <div className={css({ flex: 1 })} />

              {/* Preview width. It resizes the DOCUMENT, not an iframe — the
                  canvas is inline, so this shows how the copy breaks at each
                  width, not the front-end's own responsive CSS. "Open" is the
                  real thing, in a new tab. */}
              <div className={css({ display: "flex", gap: "2px", padding: "2px", borderRadius: "8px", flex: "none" })} style={{ background: ac.canvas, border: `1px solid ${ac.border}` }}>
                {DEVICES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDevice(d.id)}
                    aria-pressed={device === d.id}
                    title={`${d.label} — ${d.width}px column`}
                    aria-label={d.label}
                    className={css({ width: "32px", height: "32px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none", transition: "background .12s" })}
                    style={{ background: device === d.id ? ac.surface : "transparent", color: device === d.id ? ac.text : ac.muted }}
                  >
                    <Icon name={d.icon} size={15} strokeWidth={1.8} />
                  </button>
                ))}
                {previewHref ? (
                  <a
                    href={previewHref}
                    target="_blank"
                    rel="noreferrer"
                    title="Preview in new tab"
                    aria-label="Preview in new tab"
                    className={css({ width: "32px", height: "32px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .12s", _hover: { background: ac.surface } })}
                    style={{ color: ac.muted }}
                  >
                    <Icon name="external" size={14} strokeWidth={1.9} />
                  </a>
                ) : null}
              </div>

              <button type="button" onClick={() => setShowInspector((v) => !v)} aria-pressed={showInspector} className={bandBtnClass} style={{ background: showInspector ? ac.canvas : "transparent", border: `1px solid ${ac.border}`, color: showInspector ? ac.text : ac.muted }}>
                <Icon name="settings" size={15} strokeWidth={1.9} />Block settings
              </button>
            </div>

            <div className={css({ display: "flex", alignItems: "flex-start", minHeight: 0 })}>
              {inserterOpen ? (
                // The block library, docked LEFT like wp-admin's. Same sticky
                // treatment as the inspector on the right, for the same reason:
                // this admin scrolls the document, not an app frame.
                <aside className={inserterPanelClass} style={{ background: ac.surface, borderRight: `1px solid ${ac.border}` }}>
                  {/* No header of our own: the Library renders its OWN close
                      button ("Close Block Inserter") beside the tabs, so adding
                      one gave the panel two. Wiring onClose makes WP's work.
                      It stays open after an insert, as wp-admin does — building
                      a layout means inserting several blocks in a row. */}
                  <InserterLibrary showMostUsedBlocks onClose={() => setInserterOpen(false)} />
                </aside>
              ) : null}

              {/* The canvas AREA takes the whole window; the DOCUMENT inside it
                  stays at reading width and re-centres. That is what keeps the
                  inspector from costing canvas: opening it shrinks the area
                  (1080px -> 780px at 1600px wide), not the 768px document. */}
              <CanvasSelectionClearer className={css({ flex: 1, minWidth: 0 })}>
                <div className={documentAreaClass}>
                  <div className={documentColClass} style={{ maxWidth: DEVICE_WIDTH[device] }}>
                    {/* THE SHEET — the page itself, and the reason this is not
                        just a paint job: it carries the PUBLIC site's own
                        background, so an image with a white backdrop stops
                        showing a box edge here that vanishes once published.
                        Cover, title and blocks sit ON it because they ARE the
                        document; the excerpt does not, because it never renders
                        in the article body and putting it here would say it
                        does. Edges also give the device control something
                        visible to resize. */}
                    <div
                      className={sheetClass}
                      style={{ background: publishedPageBg, border: `1px solid ${ac.border}`, boxShadow: ac.shadowSm }}
                    >
                      {header}
                      {/* editor-styles-wrapper is what WP's own stylesheets target;
                          without it the canvas renders unstyled. */}
                      <div className={`editor-styles-wrapper ${canvasClass}`}>
                        <BlockTools>
                          <WritingFlow>
                            <ObserveTyping>
                              <BlockList />
                            </ObserveTyping>
                          </WritingFlow>
                        </BlockTools>
                      </div>
                    </div>
                    {footer}
                  </div>
                </div>
              </CanvasSelectionClearer>

              {showInspector ? (
                // Sticky rather than a fixed-height scroller: this admin scrolls
                // the DOCUMENT (the shell is min-height:100vh, not a 100vh
                // app frame), so a full-height flex child would have no height
                // to fill. Sticky gives the docked feel without changing the
                // shell's scroll model.
                <aside className={inspectorClass} style={{ background: ac.surface, borderLeft: `1px solid ${ac.border}` }}>
                  <BlockInspector />
                </aside>
              ) : null}
            </div>
            {/* Popovers (block toolbar, link editor, inserter) portal into
                this slot — omit it and the toolbar never appears. */}
            <Popover.Slot />
          </BlockEditorProvider>
        </SlotFillProvider>
      </ShortcutProvider>

    </div>
  );
}
// The band's standalone "Media library" button is GONE, and with it the
// append-an-image-at-the-end picker it opened. It existed because the blocks
// could not reach the library themselves; now they can (media-upload-bridge),
// so a media control that ignores where the cursor is has no reason to sit in
// a toolbar next to Block settings. Media arrives through the Image, Gallery,
// Video, Audio and File blocks — and the cover image, which has its own
// picker in ArticleEditor.

/** Preview widths. The document is not iframed, so this changes the COLUMN,
 *  which is what shows how a headline and its paragraphs break at each size.
 *  Front-end media queries are not simulated — "Open" is for that. */
type Device = "desktop" | "tablet" | "mobile";
const DEVICES: { id: Device; label: string; icon: IconName; width: number }[] = [
  // 768 is the reading column the public article page actually uses; the other
  // two are the column at a tablet and a phone. Tablet was 780 first, which is
  // WIDER than desktop — the control measured as a no-op (704 vs 716) because
  // the document is capped for readability, not by the viewport.
  { id: "desktop", label: "Desktop", icon: "monitor", width: 768 },
  { id: "tablet", label: "Tablet", icon: "tablet", width: 620 },
  { id: "mobile", label: "Mobile", icon: "phone", width: 390 },
];
const DEVICE_WIDTH: Record<Device, string> = {
  desktop: "768px",
  tablet: "620px",
  mobile: "390px",
};

/** The band: one row, fixed height, never wraps. Sticky under the 56px app top
 *  bar. Everything in it is 40px tall so WP's controls and ours share a
 *  baseline — the misalignment was a 30-vs-40 mismatch, not a spacing bug. */
const bandClass = css({
  position: "sticky",
  top: "56px",
  // ABOVE WordPress's popover layer (z-index 1000000). The block toolbar
  // floats again, and a block near the top of the viewport puts it over this
  // bar — where it used to intercept the bar's clicks. The bar wins now, and
  // the toolbar tucks under it, which is what a sticky header should do.
  zIndex: 1000001,
  display: "flex",
  alignItems: "center",
  flexWrap: "nowrap",
  gap: "8px",
  height: "56px",
  padding: "0 16px",
});

const dividerClass = css({ width: "1px", height: "24px", flex: "none" });

/** The band's own buttons, sized to WP's `is-next-40px-default-size`. */
const bandBtnClass = css({
  height: "40px",
  padding: "0 12px",
  borderRadius: "8px",
  fontSize: "13px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "7px",
  flex: "none",
  whiteSpace: "nowrap",
  transition: "background .12s",
  _hover: { background: ac.surfaceHover },
});

/** Square icon button for the band (undo/redo). Same 40px as everything else. */
const bandIconBtnClass = css({
  width: "40px",
  height: "40px",
  flex: "none",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  transition: "background .12s",
  _hover: { background: ac.surfaceHover },
  _disabled: { _hover: { background: "transparent" } },
});

/** The gutter the sheet floats in. It needs air on every side or it reads as a
 *  panel bolted to the chrome rather than a page lying on a desk. */
const documentAreaClass = css({
  padding: "32px 24px 120px",
});

/** The document column: reading width, centred in whatever space the canvas
 *  area has. This is the 768px that used to be the WHOLE editor. It wraps the
 *  sheet AND the off-sheet excerpt so both track the device width together —
 *  an excerpt field that stayed 768px while the page narrowed to 390px would
 *  look like part of the chrome. */
const documentColClass = css({
  maxWidth: "768px",
  margin: "0 auto",
});

/** The page. Horizontal padding is the 32px the document column used to carry,
 *  so the reading measure is unchanged (704px at desktop) — what moved is only
 *  what sits behind it. Deliberately NO `overflow: hidden` despite the radius:
 *  WP's drag handles, the block appender and the inserter's drop indicator all
 *  paint outside the block list, and clipping them breaks the affordances. */
const sheetClass = css({
  borderRadius: "12px",
  padding: "32px 32px 56px",
});

/** The block library, docked left. Wider than the inspector because it holds a
 *  three-column block grid plus the Patterns/Media tabs. */
const inserterPanelClass = css({
  // 350 is WP's own inserter width and its menu asserts it, so the column has
  // to be wider than that or the vertical scrollbar (9px here) steals from the
  // content and the panel scrolls sideways — measured: 341 client vs 350
  // scroll. overflowX is belt to that braces.
  width: "360px",
  flex: "none",
  position: "sticky",
  top: "112px", // 56px app bar + 56px band
  height: "calc(100vh - 112px)",
  overflowY: "auto",
  overflowX: "hidden",
  display: "flex",
  flexDirection: "column",
});

/** Docked block settings. 300px, its own scroll, sticky below the band. */
const inspectorClass = css({
  width: "300px",
  flex: "none",
  position: "sticky",
  top: "112px", // 56px app bar + 56px band
  height: "calc(100vh - 112px)",
  overflowY: "auto",
  paddingBottom: "24px",
});

// The canvas inherits WP's editor styles (imported above); these are OUR
// overrides so it sits in the dashboard's type scale rather than wp-admin's.
const canvasClass = css({
  minHeight: "320px",
  padding: "8px 0 40px",
  fontSize: "16px",
  lineHeight: 1.9,
  "& .block-editor-block-list__layout": { maxWidth: "100%" },
  "& p": { margin: "0 0 18px" },
  "& h2": { fontSize: "24px", fontWeight: 600, lineHeight: 1.6, margin: "28px 0 12px" },
  "& h3": { fontSize: "19px", fontWeight: 600, lineHeight: 1.6, margin: "22px 0 10px" },
  "& img": { maxWidth: "100%", height: "auto" },
});
