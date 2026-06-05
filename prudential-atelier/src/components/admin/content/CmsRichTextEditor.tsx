"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

type CmsRichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export function CmsRichTextEditor({ value, onChange, placeholder = "Write content…" }: CmsRichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: value,
    editorProps: {
      attributes: {
        class:
          "min-h-[240px] px-4 py-3 font-sans text-sm leading-relaxed text-ink focus:outline-none prose prose-sm max-w-none",
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="rounded-[3px] border border-sand bg-white">
      <EditorContent editor={editor} />
    </div>
  );
}
