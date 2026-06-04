"use client";

import { useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import type { Moodboard } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";

type BespokeOption = { id: string; orderRef: string };

export function MoodboardsClient({
  initial,
  bespokeOrders,
}: {
  initial: Moodboard[];
  bespokeOrders: BespokeOption[];
}) {
  const [boards, setBoards] = useState(initial);
  const [selected, setSelected] = useState<Moodboard | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [bespokeOrderId, setBespokeOrderId] = useState("");
  const [uploading, setUploading] = useState(false);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 12 - images.length)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/account/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload failed");
        const json = (await res.json()) as { url: string };
        urls.push(json.url);
      }
      setImages((prev) => [...prev, ...urls].slice(0, 12));
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function createBoard() {
    if (!title.trim()) return;
    try {
      const res = await fetch("/api/account/moodboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          notes: notes.trim() || undefined,
          images,
          bespokeOrderId: bespokeOrderId || null,
        }),
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { moodboard: Moodboard };
      setBoards((b) => [json.moodboard, ...b]);
      setCreating(false);
      setTitle("");
      setNotes("");
      setImages([]);
      setBespokeOrderId("");
      toast.success("Moodboard created");
    } catch {
      toast.error("Could not create moodboard");
    }
  }

  async function deleteBoard(id: string) {
    if (!confirm("Delete this moodboard?")) return;
    try {
      const res = await fetch(`/api/account/moodboards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setBoards((b) => b.filter((x) => x.id !== id));
      setSelected(null);
      toast.success("Moodboard deleted");
    } catch {
      toast.error("Delete failed");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-4xl text-choc">Moodboards</h1>
        <button type="button" onClick={() => setCreating(true)} className="btn-primary">
          Create New Moodboard
        </button>
      </div>

      {boards.length === 0 ? (
        <p className="mt-16 text-center font-sans text-sm text-text-mid">
          No moodboards yet — upload your inspiration images
        </p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelected(b)}
              className="card-surface overflow-hidden text-left transition hover:shadow-md"
            >
              <div className="grid grid-cols-2 gap-0.5 bg-sand">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="relative aspect-square bg-bg">
                    {b.images[i] ? (
                      <Image src={b.images[i]!} alt="" fill className="object-cover" unoptimized />
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="p-4">
                <p className="font-display text-lg text-choc">{b.title}</p>
                <p className="font-sans text-xs text-text-light">{formatDate(b.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ""}>
        {selected ? (
          <div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selected.images.map((url) => (
                <div key={url} className="relative aspect-square">
                  <Image src={url} alt="" fill className="object-cover" unoptimized />
                </div>
              ))}
            </div>
            {selected.notes ? (
              <p className="mt-4 font-sans text-sm text-text-mid">{selected.notes}</p>
            ) : null}
            <button
              type="button"
              onClick={() => deleteBoard(selected.id)}
              className="mt-6 font-sans text-xs text-red-600 underline"
            >
              Delete moodboard
            </button>
          </div>
        ) : null}
      </Modal>

      {creating ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-ivory p-6">
            <h2 className="font-display text-2xl text-choc">New Moodboard</h2>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="mt-4 w-full border border-sand px-3 py-2 font-sans text-sm"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              rows={3}
              className="mt-3 w-full border border-sand px-3 py-2 font-sans text-sm"
            />
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => uploadFiles(e.target.files)}
              className="mt-3 w-full font-sans text-sm"
            />
            {uploading ? <p className="mt-2 text-xs text-text-light">Uploading…</p> : null}
            {bespokeOrders.length > 0 ? (
              <select
                value={bespokeOrderId}
                onChange={(e) => setBespokeOrderId(e.target.value)}
                className="mt-3 w-full border border-sand px-3 py-2 font-sans text-sm"
              >
                <option value="">Link to order (optional)</option>
                {bespokeOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderRef}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setCreating(false)} className="btn-ghost-light">
                Cancel
              </button>
              <button type="button" onClick={createBoard} className="btn-primary">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
