// Which WordPress POST TEMPLATE an article should carry — what renders the
// tail BELOW the article body on the WordPress site. A post left on "Default
// template" shows nothing after the body.
//
// DISABLED 2026-09-01. The mapping below (entertainment-news, movie-and-music,
// love-and-relation, health-and-beauty, life-style, …) was mined against a
// DIFFERENT site's database — the same kind of entertainment/infotainment
// content categories, not economy's. None of those template filenames are
// registered on economy.ams.com.kh's theme: every suggestion WordPress saw was
// rejected with a live 400 `rest_invalid_param` on `template`, which is why
// article save/create could not save at all. Rather than guess a
// wrong-but-plausible-looking value again, this now always returns
// DEFAULT_TEMPLATE, which WordPress always accepts.
//
// economy.ams.com.kh's real registered article templates (captured from a
// live 400 response's rejection list, 2026-09-01 — truncated, there may be
// more):
//   templates/business-template.php
//   templates/economic-template.php
//   templates/finance-template.php
//   templates/general-knowledge-template.php
//   templates/pr-…-template.php (name cut off in the captured response)
// Re-enabling suggestion needs the same methodology the education-site mapping
// used: sample economy's own live posts per category, and the owner's call on
// the ambiguous ones — not a guess from the names above.

import type { CategoryNode } from "./categories";

/** WordPress's own value for "Default template" — no tail. */
export const DEFAULT_TEMPLATE = "";

export function suggestTemplate(_categoryIds: readonly number[], _categories: readonly CategoryNode[]): string {
  return DEFAULT_TEMPLATE;
}
