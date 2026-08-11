// Centralized admin palette.
//
// WHAT CHANGED, AND WHY IT MATTERS AT EVERY CALL SITE: these used to be literal
// hex strings. They are now CSS custom properties emitted by Panda's semantic
// tokens (see the `admin` block in panda.config.ts), which flip on
// `[data-theme="dark"]`.
//
// That indirection is the whole dark-mode mechanism. The admin applies most of
// its colour through inline `style={{ … }}` — deliberately, because Panda
// extracts `css()` statically and cannot see runtime-computed values — and an
// inline literal hex can never respond to a theme. A `var()` can. So every
// existing `style={{ background: ac.surface }}` keeps working untouched and
// simply resolves per theme.
//
// The theme itself is the SITE's existing mechanism, not a second one: the root
// layout's pre-paint script and `ThemeToggle` already own `data-theme` on
// <html> for the public site, and the admin now rides the same attribute.
//
// Values are measured, not chosen by eye — see the panda.config.ts header for
// what was validated (all-pairs CVD on the categorical hues, WCAG AA on every
// text and status role, in BOTH themes).
export const ac = {
  /* ---- surfaces ---- */
  canvas: "var(--colors-admin-canvas)",
  surface: "var(--colors-admin-surface)",
  surfaceHover: "var(--colors-admin-surface-hover)",
  /** Recessed: table header bands, segmented-control tracks, input fills. */
  surfaceSunken: "var(--colors-admin-surface-sunken)",
  rowLine: "var(--colors-admin-row-line)",
  border: "var(--colors-admin-border)",
  borderStrong: "var(--colors-admin-border-strong)",

  /* ---- ink ---- */
  text: "var(--colors-admin-text)", // primary
  sub: "var(--colors-admin-sub)", // secondary
  muted: "var(--colors-admin-muted)", // tertiary / meta — AA on every surface
  /** Placeholders, chart axis labels, decorative rules. Clears 3:1, not 4.5 —
   *  never use it for text a reader must be able to read comfortably. */
  faint: "var(--colors-admin-faint)",

  /* ---- AMS red: primary actions + active nav ONLY ---- */
  accent: "var(--colors-admin-accent)",
  accentHover: "var(--colors-admin-accent-hover)",
  /** Text/icon colour ON an accent fill. */
  accentFg: "var(--colors-admin-accent-fg)",
  /** The accent used AS text or an icon on a surface. Not the same value as
   *  `accent` in dark mode — a fill that clears AA on white does not on
   *  near-black. */
  accentText: "var(--colors-admin-accent-text)",
  accentTint: "var(--colors-admin-accent-tint)",

  /* ---- status: colour informs, never decorates, never the only channel ---- */
  good: "var(--colors-admin-good)",
  goodTint: "var(--colors-admin-good-tint)",
  warn: "var(--colors-admin-warn)",
  warnTint: "var(--colors-admin-warn-tint)",
  danger: "var(--colors-admin-danger)",
  dangerTint: "var(--colors-admin-danger-tint)",
  /** Destructive BUTTON fill — needs white on it at 4.5:1, which the `danger`
   *  text step above is far too light for in dark mode. */
  dangerFill: "var(--colors-admin-danger-fill)",
  neutralTint: "var(--colors-admin-neutral-tint)",

  /* ---- data ---- */
  /** Categorical slot 1, and the only colour a single-series chart uses. */
  data: "var(--colors-admin-data)",
  dataSoft: "var(--colors-admin-data-soft)",
  cat2: "var(--colors-admin-cat2)",
  cat3: "var(--colors-admin-cat3)",
  cat4: "var(--colors-admin-cat4)",

  /* ---- chrome ---- */
  focus: "var(--colors-admin-focus)",
  overlay: "var(--colors-admin-overlay)",

  /** Diagonal-stripe fill for image placeholders where there is no real media. */
  skeleton:
    "repeating-linear-gradient(45deg,var(--colors-admin-skeleton-base),var(--colors-admin-skeleton-base) 5px,var(--colors-admin-skeleton-sheen) 5px,var(--colors-admin-skeleton-sheen) 10px)",
  skeletonBase: "var(--colors-admin-skeleton-base)",
  skeletonSheen: "var(--colors-admin-skeleton-sheen)",

  /** Elevation. Dark mode gets its own, deeper values — a 5%-black shadow is
   *  invisible on a near-black canvas. */
  shadowSm: "var(--shadows-admin-sm)",
  shadowMd: "var(--shadows-admin-md)",
} as const;

/** The PUBLIC site's page background — deliberately NOT an `admin.*` token.
 *
 *  The article editor's document sheet paints itself with this so a writer's
 *  words sit on the exact surface they publish onto. `ArticleBody` sets no
 *  background of its own, so a published article inherits `page.bg`: #ffffff
 *  in light, #0e0e12 in dark.
 *
 *  Why not `ac.surface`: in light mode the two are the same #FFFFFF and the
 *  difference never shows — then dark mode arrives and the sheet quietly drifts
 *  to the admin's #131926, a full step lighter than any article the reader will
 *  ever see. The point of the sheet is fidelity; borrow the real token. */
export const publishedPageBg = "var(--colors-page-bg)";

/** The four categorical slots, in fixed order. Assign by ENTITY and never
 *  cycle: a fifth series folds into "Other" or the chart facets into small
 *  multiples. Four is the validated ceiling — six failed all-pairs colour-vision
 *  separation, so a fifth hue would be a guess dressed as a decision. */
export const CATEGORICAL = [ac.data, ac.cat2, ac.cat3, ac.cat4] as const;

/** WordPress's post statuses, minus the one this server cannot honour:
 *  `future` (Scheduled). The site's loopback is broken, so WP-Cron never fires
 *  and a scheduled post simply never publishes — offering it would be a
 *  promise the server does not keep. See the Publish card. */
export type Status = "Published" | "Pending" | "Draft" | "Private";

export function statusColors(s: Status): { fg: string; bg: string } {
  switch (s) {
    case "Published":
      return { fg: ac.good, bg: ac.goodTint };
    case "Pending":
      return { fg: ac.warn, bg: ac.warnTint };
    case "Private":
      // Not a warning colour: private is a deliberate editorial state, not a
      // problem. Neutral reads as "restricted" without shouting.
      return { fg: ac.sub, bg: ac.neutralTint };
    default:
      return { fg: ac.muted, bg: ac.neutralTint };
  }
}
