// Which WordPress POST TEMPLATE an article should carry — what renders the
// tail BELOW the article body on the WordPress site. A post left on "Default
// template" shows nothing after the body.
//
// This map is Economy-specific. It was verified against the live category tree
// and stored templates on 2026-09-02; the filenames below all occur on real
// economy.ams.com.kh posts. Use slugs rather than ids so a taxonomy migration
// does not silently disconnect the suggestion.
//
// The report subtree mirrors the same subjects. Its older posts mostly carry
// no template, but selecting a subject should behave consistently with News —
// this is the same owner rule used by Info's editor to avoid a blank tail.
// Container/modifier categories (all-news, all-report, top-news and
// news-inclusive-business) intentionally have no entry: when selected with a
// topic they do not override it, and by themselves they leave Default intact.
// Interview/feature also stays Default because every live post sampled in its
// News and Report categories carries no template.

import type { CategoryNode } from "./categories";

/** WordPress's own value for "Default template" — no tail. */
export const DEFAULT_TEMPLATE = "";

/**
 * Strongest first for the uncommon case where an article has more than one
 * topic category. Narrow editorial formats beat the broad Economy subjects.
 */
const CATEGORY_TEMPLATES: ReadonlyArray<readonly [slug: string, template: string]> = [
  ["news-pr", "templates/pr-template.php"],
  ["report-pr", "templates/pr-template.php"],
  ["news-general-knowledge", "templates/general-knowledge-template.php"],
  ["report-general-knowledge", "templates/general-knowledge-template.php"],
  ["news-startup-and-innovation", "templates/start-up-innovation-template.php"],
  ["report-startup-and-innovation", "templates/start-up-innovation-template.php"],
  ["news-business", "templates/business-template.php"],
  ["report-business", "templates/business-template.php"],
  ["news-realestate", "templates/real-estate-template.php"],
  ["report-realestate", "templates/real-estate-template.php"],
  ["news-finance", "templates/finance-template.php"],
  ["report-finance", "templates/finance-template.php"],
  ["news-economic", "templates/economic-template.php"],
  ["report-economic", "templates/economic-template.php"],
];

/** Return the Economy template suggested by the checked topic categories. */
export function suggestTemplate(categoryIds: readonly number[], categories: readonly CategoryNode[]): string {
  if (categoryIds.length === 0) return DEFAULT_TEMPLATE;

  const selected = new Set(categoryIds);
  const selectedSlugs = new Set(categories.filter((category) => selected.has(category.id)).map((category) => category.slug));

  return CATEGORY_TEMPLATES.find(([slug]) => selectedSlugs.has(slug))?.[1] ?? DEFAULT_TEMPLATE;
}
