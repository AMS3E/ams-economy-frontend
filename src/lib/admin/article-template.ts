// Which WordPress post template a new Economy article should carry.
//
// This mapping was measured from 200 recent live posts on 2026-08-25. Those
// posts use seven stable topic templates. The broad ព្រឹត្តិការណ៍ category and
// Top News are filing helpers, not template sources, so a selected topic wins.

import type { CategoryNode } from "./categories";

/** WordPress's own value for "Default template". */
export const DEFAULT_TEMPLATE = "";

const ECONOMIC = "templates/economic-template.php";

/** Topic categories, strongest first when an article is filed in more than one. */
const RANKED_TOPICS: ReadonlyArray<readonly [id: number, template: string]> = [
  [243, ECONOMIC], // សេដ្ឋកិច្ច
  [247, "templates/finance-template.php"], // ហិរញ្ញវត្ថុ
  [249, "templates/real-estate-template.php"], // អចលនទ្រព្យ
  [251, "templates/business-template.php"], // ជំនួញ
  [253, "templates/start-up-innovation-template.php"], // អាជីវកម្មថ្មី និងនវានុវត្ត
  [255, "templates/general-knowledge-template.php"], // ចំណេះដឹងទូទៅ
  [257, "templates/pr-template.php"], // អត្ថបទពាណិជ្ជកម្ម
];

/**
 * Suggest a theme template from the checked categories.
 *
 * Category IDs are the measured source of truth. `categories` remains part of
 * the signature shared with the editor and lets descendants inherit a mapped
 * topic if Economy adds a nested category later. An unrecognised selection
 * gets Economic, the dominant live template, rather than a blank article tail.
 */
export function suggestTemplate(categoryIds: readonly number[], categories: readonly CategoryNode[]): string {
  const selected = new Set(categoryIds);
  for (const [id, template] of RANKED_TOPICS) {
    if (selected.has(id)) return template;
  }

  const parentOf = new Map(categories.map((category) => [category.id, category.parent]));
  const templateOf = new Map(RANKED_TOPICS);
  for (const categoryId of categoryIds) {
    const seen = new Set<number>();
    let current = parentOf.get(categoryId);
    while (current && !seen.has(current)) {
      const inherited = templateOf.get(current);
      if (inherited) return inherited;
      seen.add(current);
      current = parentOf.get(current);
    }
  }

  return ECONOMIC;
}
