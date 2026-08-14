import { css, cx } from "@/styled-system/css";
import { container } from "@/components/layout/shared";
import { LeadBesideRows, Ranked } from "@/components/landing/blocks";
import type { ArticleRef, PopularItem } from "@/lib/articles";

/** Section — "អាជីវកម្មថ្មី និងនវានុវត្ត" (a lead card beside its rows) next to
 *  "សេដ្ឋកិច្ច" (a numbered ranked list): the NAV_SECTIONS start-up-innovation
 *  and economic terms (see categories.ts) surfaced on the homepage the same way
 *  a landing page runs its ចំណាប់អារម្មណ៍ / ប្រធានបទពេញនិយម pair. */
export default function BusinessInnovationSection({ innovation, economic }: { innovation: ArticleRef[]; economic: PopularItem[] }) {
  if (!innovation.length && !economic.length) return null;

  return (
    <div
      className={cx(
        container,
        css({
          marginTop: "44px",
          display: "grid",
          gridTemplateColumns: { base: "1fr", lg: "minmax(0,1fr) 420px" },
          gap: "44px 34px",
          alignItems: "start",
        }),
      )}
    >
      <LeadBesideRows
        block={{ heading: "អាជីវកម្មថ្មី និងនវានុវត្ត", href: "/start-up-innovation", items: innovation }}
        sizes="(max-width: 768px) 100vw, 500px"
        detailed
      />
      <Ranked block={{ heading: "សេដ្ឋកិច្ច", href: "/economic", items: economic }} variant="line" />
    </div>
  );
}
