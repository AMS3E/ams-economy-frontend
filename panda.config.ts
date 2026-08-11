import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // Panda's baseline CSS reset.
  preflight: true,

  // Where to look for style usage (css(), patterns, recipes, jsx).
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  exclude: [],

  // Enables the styled() JSX factory + prop typings.
  jsxFramework: "react",

  // Our dark mode is driven by a `data-theme` attribute on <html> (set by
  // ThemeToggle), so point Panda's `_dark` condition at that selector instead
  // of the default `.dark &`.
  conditions: {
    extend: {
      dark: '[data-theme="dark"] &',
      light: '[data-theme="light"] &',
    },
  },

  theme: {
    extend: {
      // Sweeps the `sheen` band of CoverImage's placeholder gradient across the
      // tile, left to right. Paired with `backgroundSize: 200% 100%`, so 100% ->
      // 0% moves the highlight the full width of the element exactly once.
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "0% 0" },
        },
      },

      tokens: {
        colors: {
          // Fixed brand colors used across the site.
          brand: {
            blue: { value: "#1a5fd0" },
            orange: { value: "#e0533e" },
            pink: { value: "#e0264f" },
            green: { value: "#0f9d58" },
            red: { value: "#dd1111" },
          },
        },
      },
      semanticTokens: {
        // Elevation. Dark mode does not just reuse the light shadows — on a
        // near-black canvas a 5%-black shadow is invisible, so depth there comes
        // from a deeper, wider shadow plus the lighter surface step.
        shadows: {
          adminSm: {
            value: {
              base: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
              _dark: "0 1px 2px rgba(0,0,0,0.40)",
            },
          },
          adminMd: {
            value: {
              base: "0 8px 24px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.05)",
              _dark: "0 12px 28px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.40)",
            },
          },
        },
        colors: {
          // Theme-aware tokens (light default / dark override). These generate
          // CSS variables that flip based on the `data-theme` attribute.
          page: {
            bg: { value: { base: "#ffffff", _dark: "#0e0e12" } },
          },
          text: { value: { base: "#1a1a22", _dark: "#ececed" } },
          muted: { value: { base: "#8a8a93", _dark: "#8b8c95" } },
          hero: {
            bg: { value: { base: "#eef0f3", _dark: "#1a1b22" } },
            sub: { value: { base: "#555555", _dark: "#b8b9c0" } },
          },
          divider: { value: { base: "#e6e7ea", _dark: "rgba(255,255,255,0.1)" } },

          // Image placeholder surface (see CoverImage). `base` is the resting
          // color — also the whole of the empty/broken state — and `sheen` is the
          // brighter band the shimmer sweeps across while an image loads.
          //
          // Sections painted dark in *both* themes (PosterBand, PopularProgramsBand,
          // VideoFeatureStrip) carry their own `data-theme="dark"`, which is what
          // makes these resolve to the dark values there even in light mode.
          skeleton: {
            base: { value: { base: "#e9eaee", _dark: "#20212a" } },
            sheen: { value: { base: "#f4f5f7", _dark: "#2c2d38" } },
          },

          // Floating controls that sit ON another surface (carousel arrows), so
          // they can't inherit `page.bg` — inside a dark band that would make
          // them invisible. They stay one step lighter than whatever is behind.
          control: {
            bg: { value: { base: "#ffffff", _dark: "#20212a" } },
            fg: { value: { base: "#15161d", _dark: "#ececed" } },
          },

          // The program page's cinematic hero band, read top-to-bottom as a
          // radial gradient. Dark values are the design's; light values fade the
          // same shape into the page so the title still reads.
          programHero: {
            from: { value: { base: "#f2f3f6", _dark: "#2a2d33" } },
            mid: { value: { base: "#e9ebef", _dark: "#14161a" } },
            to: { value: { base: "#ffffff", _dark: "#0a0a0a" } },
          },

          /* ================================================================
           * ADMIN — the dashboard tool's palette.
           * ----------------------------------------------------------------
           * Kept in Panda semantic tokens (rather than the plain literal map
           * `ac` used to be) for ONE reason: dark mode. `ac` is consumed
           * through inline `style` in dozens of places, and an inline literal
           * hex cannot respond to a theme. As CSS variables those same call
           * sites keep working untouched and simply resolve per theme — see
           * src/components/admin/tokens.ts.
           *
           * The dark column is SELECTED, not an inversion: its own steps
           * against the dark surface.
           *
           * MEASURED, not eyeballed (2026-08-05):
           *  - The four categorical hues pass the dataviz validator on ALL
           *    pairs in both modes — lightness band, chroma floor, CVD
           *    separation, normal-vision floor and contrast vs surface.
           *    Four is the ceiling: six failed all-pairs CVD, and past four
           *    the rule is to facet or fold into "Other", never add a hue.
           *  - Every text and status role clears WCAG AA (4.5:1) against
           *    surface, canvas AND sunken; `faint` and the focus ring clear
           *    3:1. Hairlines are deliberately below that — a row separator
           *    carries no information a control's border would.
           * ================================================================ */
          admin: {
            // Surfaces. Cool slate rather than the old warm stone: the single
            // biggest reason the tool reads "product dashboard" now.
            canvas: { value: { base: "#F6F7F9", _dark: "#0B0F17" } },
            surface: { value: { base: "#FFFFFF", _dark: "#131926" } },
            surfaceHover: { value: { base: "#F6F7F9", _dark: "#1A2231" } },
            surfaceSunken: { value: { base: "#F0F2F5", _dark: "#0F1520" } },
            rowLine: { value: { base: "#EDEFF3", _dark: "#1F2836" } },
            border: { value: { base: "#E2E6EB", _dark: "#263041" } },
            borderStrong: { value: { base: "#C8CFD8", _dark: "#3A465A" } },

            // Ink. `faint` is decorative/placeholder — but it also carries
            // chart axis labels, which is why it clears 3:1 rather than
            // sitting at the old palette's ~2.6:1.
            text: { value: { base: "#0F172A", _dark: "#E9EEF6" } },
            sub: { value: { base: "#475569", _dark: "#B3C0D1" } },
            muted: { value: { base: "#5B6A7D", _dark: "#8B99AC" } },
            faint: { value: { base: "#7D8CA1", _dark: "#6B7C93" } },

            // AMS red — primary actions and active nav ONLY. Both reference
            // templates are blue because they are generic products with no
            // brand; adopting that would be wearing someone else's identity.
            accent: { value: { base: "#C8102E", _dark: "#D91E3B" } },
            accentHover: { value: { base: "#A90D27", _dark: "#EE2E4B" } },
            accentFg: { value: { base: "#FFFFFF", _dark: "#FFFFFF" } },
            // The accent used AS text/icon on a surface — a fill colour that
            // clears 4.5:1 on white does not on near-black, so dark lifts it.
            accentText: { value: { base: "#C8102E", _dark: "#FF8095" } },
            accentTint: { value: { base: "rgba(200,16,46,0.06)", _dark: "rgba(217,30,59,0.16)" } },

            // Status. Colour INFORMS; it is never the only channel — every use
            // ships with a label, and usually an icon.
            good: { value: { base: "#15803D", _dark: "#4ADE80" } },
            goodTint: { value: { base: "rgba(21,128,61,0.09)", _dark: "rgba(74,222,128,0.14)" } },
            warn: { value: { base: "#B45309", _dark: "#FBBF24" } },
            warnTint: { value: { base: "rgba(180,83,9,0.10)", _dark: "rgba(251,191,36,0.14)" } },
            danger: { value: { base: "#B42318", _dark: "#FF7B72" } },
            dangerTint: { value: { base: "rgba(180,35,24,0.08)", _dark: "rgba(255,123,114,0.13)" } },
            // Destructive BUTTON fill, which needs white on it at 4.5:1 — the
            // dark `danger` above is a text step and is far too light for that.
            dangerFill: { value: { base: "#B42318", _dark: "#C4362E" } },
            neutralTint: { value: { base: "rgba(71,85,105,0.08)", _dark: "rgba(179,192,209,0.12)" } },

            // Data. Slot 1 is the teal the charts already use; 2–4 exist so a
            // multi-series chart or a set of tinted chips has a validated set
            // to draw from instead of inventing hues at the call site.
            data: { value: { base: "#0D9488", _dark: "#12A899" } },
            dataSoft: { value: { base: "rgba(13,148,136,0.12)", _dark: "rgba(18,168,153,0.18)" } },
            cat2: { value: { base: "#2563EB", _dark: "#2563EB" } },
            cat3: { value: { base: "#D97706", _dark: "#D97706" } },
            cat4: { value: { base: "#A21CAF", _dark: "#AE2ABE" } },

            focus: { value: { base: "#C8102E", _dark: "#FF8095" } },
            overlay: { value: { base: "rgba(15,23,42,0.45)", _dark: "rgba(0,0,0,0.62)" } },
            skeletonBase: { value: { base: "#EDEFF3", _dark: "#1A2231" } },
            skeletonSheen: { value: { base: "#F6F7F9", _dark: "#222C3C" } },
          },
        },
      },
    },
  },

  // Emit under src/ so it resolves through the existing `@/*` path alias.
  outdir: "src/styled-system",
});
