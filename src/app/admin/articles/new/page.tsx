import ArticleEditor from "@/components/admin/articles/ArticleEditor";
import { readCategories, type CategoryNode } from "@/lib/admin/categories";
import { listPostTemplates, type PostTemplate } from "@/lib/admin/post-edit";
import { AdminAuthError } from "@/lib/admin/client";
import { redirectToLogin } from "@/lib/auth/session";

// New Article — the editor in "create" mode. Categories are loaded so the picker
// is real; everything else starts blank (status Draft).
export default async function AdminNewArticlePage() {
  let categories: CategoryNode[] = [];
  let templates: PostTemplate[] = [];
  try {
    // Both at once — see the [id] page for why this must not be sequential.
    [categories, templates] = await Promise.all([readCategories(), listPostTemplates()]);
  } catch (e) {
    if (e instanceof AdminAuthError) await redirectToLogin();
    // A category-list hiccup shouldn't block creating an article.
  }
  return <ArticleEditor mode="create" categories={categories} templates={templates} />;
}
