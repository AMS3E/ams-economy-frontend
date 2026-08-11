import { css } from "@/styled-system/css";
import ArticlesTabs from "@/components/admin/articles/ArticlesTabs";
import CategoriesScreen from "@/components/admin/articles/CategoriesScreen";

// Client-first since the TanStack Query migration: the manager fetches through
// the /api/admin/categories BFF and caches in the browser.
export default function AdminCategoriesPage() {
  return (
    <div className={css({ padding: "32px 40px 48px" })}>
      <ArticlesTabs />
      <CategoriesScreen />
    </div>
  );
}
