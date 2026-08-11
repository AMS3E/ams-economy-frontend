import { notFound, redirect } from "next/navigation";
import ArticleEditor from "@/components/admin/articles/ArticleEditor";
import { getPostForEdit, type EditablePost } from "@/lib/admin/post-edit";
import { readCategories, type CategoryNode } from "@/lib/admin/categories";
import { AdminAuthError } from "@/lib/admin/client";

// The article editor, loading the real post selected by [id] plus the category
// tree, both as the logged-in user.
export default async function AdminArticleEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) notFound();

  let post: EditablePost | null;
  let categories: CategoryNode[];
  try {
    [post, categories] = await Promise.all([getPostForEdit(postId), readCategories()]);
  } catch (e) {
    if (e instanceof AdminAuthError) redirect("/login");
    throw e;
  }

  if (!post) notFound();
  return <ArticleEditor mode="edit" post={post} categories={categories} />;
}
