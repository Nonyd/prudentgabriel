import { BlogEditorClient } from "@/components/admin/BlogEditorClient";

type Props = { params: Promise<{ id: string }> };

export default async function AdminBlogEditPage({ params }: Props) {
  const { id } = await params;
  return <BlogEditorClient postId={id} />;
}
