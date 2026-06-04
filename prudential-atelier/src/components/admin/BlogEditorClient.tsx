"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import toast from "react-hot-toast";
import type { BlogStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  category: string | null;
  status: BlogStatus;
  publishedAt: string | null;
  metaTitle: string | null;
  metaDesc: string | null;
};

export function BlogEditorClient({ postId }: { postId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!postId);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<BlogStatus>("DRAFT");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your article…" }),
    ],
    editorProps: {
      attributes: {
        class:
          "min-h-[280px] px-4 py-3 font-sans text-sm leading-relaxed text-ink focus:outline-none prose prose-sm max-w-none",
      },
    },
    immediatelyRender: false,
  });

  const loadPost = useCallback(async () => {
    if (!postId) return;
    const res = await fetch(`/api/blog/${postId}`);
    if (!res.ok) {
      toast.error("Failed to load post");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { item: BlogPost };
    const post = data.item;
    setTitle(post.title);
    setExcerpt(post.excerpt ?? "");
    setCategory(post.category ?? "");
    setStatus(post.status);
    setMetaTitle(post.metaTitle ?? "");
    setMetaDesc(post.metaDesc ?? "");
    editor?.commands.setContent(post.content);
    setLoading(false);
  }, [postId, editor]);

  useEffect(() => {
    void loadPost();
  }, [loadPost]);

  async function save(nextStatus?: BlogStatus) {
    const content = editor?.getHTML() ?? "";
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        content,
        excerpt: excerpt || undefined,
        category: category || undefined,
        status: nextStatus ?? status,
        metaTitle: metaTitle || undefined,
        metaDesc: metaDesc || undefined,
      };
      const res = postId
        ? await fetch(`/api/blog/${postId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/blog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = (await res.json()) as { error?: string; item?: { id: string } };
      if (!res.ok) {
        toast.error(data.error ?? "Save failed");
        return;
      }
      toast.success(nextStatus === "PUBLISHED" ? "Published" : "Saved");
      if (!postId && data.item?.id) {
        router.push(`/admin/content/blog/${data.item.id}/edit`);
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="font-sans text-sm text-text-mid">Loading editor…</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/content/blog"
            className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light hover:text-nut"
          >
            ← Blog
          </Link>
          <h1 className="mt-2 font-display text-2xl text-ink">
            {postId ? "Edit Post" : "New Post"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" loading={saving} onClick={() => void save("DRAFT")}>
            Save Draft
          </Button>
          <Button loading={saving} onClick={() => void save("PUBLISHED")}>
            Publish Now
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <label className="block">
            <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-sand px-3 py-2 font-serif text-xl text-choc"
            />
          </label>
          <div className="card-surface overflow-hidden">
            <div className="flex flex-wrap gap-1 border-b border-sand bg-bg/50 p-2">
              {(
                [
                  ["bold", "Bold"],
                  ["italic", "Italic"],
                  ["bulletList", "List"],
                  ["orderedList", "Numbered"],
                  ["blockquote", "Quote"],
                ] as const
              ).map(([cmd, label]) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => {
                    if (cmd === "bold") editor?.chain().focus().toggleBold().run();
                    if (cmd === "italic") editor?.chain().focus().toggleItalic().run();
                    if (cmd === "bulletList") editor?.chain().focus().toggleBulletList().run();
                    if (cmd === "orderedList") editor?.chain().focus().toggleOrderedList().run();
                    if (cmd === "blockquote") editor?.chain().focus().toggleBlockquote().run();
                  }}
                  className="rounded px-2 py-1 font-sans text-[10px] uppercase tracking-wide text-text-mid hover:bg-sand/30"
                >
                  {label}
                </button>
              ))}
            </div>
            <EditorContent editor={editor} />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card-surface space-y-3 p-4">
            <label className="block">
              <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BlogStatus)}
                className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
              >
                <option value="DRAFT">Draft</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Category</span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Excerpt</span>
              <textarea
                rows={3}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
              />
            </label>
          </div>
          <div className="card-surface space-y-3 p-4">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
              SEO
            </p>
            <input
              placeholder="Meta title"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
            />
            <textarea
              rows={2}
              placeholder="Meta description"
              value={metaDesc}
              onChange={(e) => setMetaDesc(e.target.value)}
              className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
