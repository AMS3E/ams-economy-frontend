import { css } from "@/styled-system/css";
import ArticlesTabs from "@/components/admin/articles/ArticlesTabs";
import TagsScreen from "@/components/admin/articles/TagsScreen";

// Client-first since the TanStack Query migration: the manager fetches through
// the /api/admin/tags BFF and caches in the browser. Search/page state stays
// in the URL, read client-side via useSearchParams.
export default function AdminTagsPage() {
  return (
    <div className={css({ padding: "32px 40px 48px" })}>
      <ArticlesTabs />
      <TagsScreen />
    </div>
  );
}
