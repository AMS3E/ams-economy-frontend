// Which Slider Revolution slider each landing page shows.
//
// Read off the live pages' own markup (`data-alias` on the slider wrapper) —
// several pages share one slider, which is the CMS's arrangement, not a typo.
// The homepage's alias is the /hero-embed default and isn't listed.
//
// Any alias sent here must also be in the WP plugin's whitelist
// (ams_afa_hero_aliases in docs/wordpress/ams-frontend-api.php) — the embed
// falls back to the homepage slider for anything it doesn't recognise, which is
// also exactly what happens everywhere until plugin ≥1.5.0 is deployed.

const HERO_ALIASES: Record<string, string> = {
  "entertainment-news": "cover-animation-14-12",
  "life-style": "cover-animation-11",
  celebrity: "entainment-home-page-1",
  "movie-and-music": "entainment-home-page-1-1",
  culture: "entainment-home-page-1-1",
  strange: "entainment-home-page-1-1-1",
  "life-style/travel": "life-style-home-page-1",
  "life-style/architecture": "life-style-home-page-1",
  "life-style/love-and-relation": "life-style-home-page-1-1",
  "life-style/health-and-beauty": "life-style-home-page-1-1-1",
  "life-style/life-tips": "celebrity-new-1",
};

/** The slider alias for a landing path ("life-style/travel"), or undefined for
 *  the homepage slider. */
export const heroAlias = (path: string): string | undefined => HERO_ALIASES[path];
