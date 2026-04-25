"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { GalleryCategory, GalleryImage } from "@prisma/client";
import toast from "react-hot-toast";
import { Eye, EyeOff, Trash2, Pencil, ChevronUp, ChevronDown, Loader2 } from "lucide-react";

type UploadJob = {
  id: string;
  name: string;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

function newJobId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function uploadGalleryFile(
  file: File,
  category: GalleryCategory,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/gallery");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(xhr.responseText || "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    xhr.send(fd);
  });
}

async function fetchPage(category: GalleryCategory, page: number) {
  const res = await fetch(`/api/admin/gallery?category=${category}&page=${page}&limit=30`);
  if (!res.ok) throw new Error("Failed to load");
  return (await res.json()) as {
    images: GalleryImage[];
    total: number;
    page: number;
    totalPages: number;
  };
}

export function GalleryManager() {
  const [tab, setTab] = useState<GalleryCategory>("ATELIER");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ images: GalleryImage[]; total: number; totalPages: number } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [uploadInFlight, setUploadInFlight] = useState(false);
  const [reorder, setReorder] = useState(false);
  const [editing, setEditing] = useState<GalleryImage | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editPublished, setEditPublished] = useState(true);
  const [editSort, setEditSort] = useState(0);

  const load = useCallback(async () => {
    try {
      const j = await fetchPage(tab, page);
      setData({ images: j.images, total: j.total, totalPages: j.totalPages });
    } catch {
      toast.error("Could not load gallery");
    }
  }, [tab, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const move = async (index: number, dir: -1 | 1) => {
    if (!data) return;
    const next = [...data.images];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    const orderedIds = next.map((x) => x.id);
    const res = await fetch("/api/admin/gallery/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok) toast.error("Reorder failed");
    else {
      toast.success("Order updated");
      void load();
    }
  };

  const togglePublished = async (img: GalleryImage) => {
    const res = await fetch(`/api/admin/gallery/${img.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !img.isPublished }),
    });
    if (!res.ok) toast.error("Update failed");
    else void load();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/gallery/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Delete failed");
    else {
      toast.success("Removed");
      void load();
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const res = await fetch(`/api/admin/gallery/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alt: editAlt || null,
        caption: editCaption || null,
        isPublished: editPublished,
        sortOrder: editSort,
      }),
    });
    if (!res.ok) toast.error("Save failed");
    else {
      toast.success("Saved");
      setEditing(null);
      void load();
    }
  };

  const onUploadFiles = async (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : [];
    if (!list.length) return;

    const jobs: UploadJob[] = list.map((file) => ({
      id: newJobId(),
      name: file.name,
      progress: 0,
      status: "queued",
    }));
    setUploadJobs(jobs);
    setUploadInFlight(true);

    let ok = 0;
    let fail = 0;
    await Promise.all(
      list.map(async (file, i) => {
        const jobId = jobs[i].id;
        setUploadJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: "uploading" as const } : j)));
        try {
          await uploadGalleryFile(file, tab, (pct) => {
            setUploadJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, progress: pct } : j)));
          });
          setUploadJobs((prev) =>
            prev.map((j) => (j.id === jobId ? { ...j, status: "done" as const, progress: 100 } : j)),
          );
          ok += 1;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Upload failed";
          setUploadJobs((prev) =>
            prev.map((j) => (j.id === jobId ? { ...j, status: "error" as const, error: msg, progress: 0 } : j)),
          );
          fail += 1;
          toast.error(`${file.name}: ${msg}`);
        }
      }),
    );

    setUploadInFlight(false);
    void load();
    if (ok > 0 && fail === 0) toast.success(`${ok} image${ok === 1 ? "" : "s"} uploaded`);
    else if (ok > 0 && fail > 0) toast(`Finished with errors: ${ok} ok, ${fail} failed`, { icon: "⚠️" });
  };

  const images = data?.images ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 border-b border-[#EBEBEA]">
          {(["ATELIER", "BRIDAL"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTab(c)}
              className={`px-4 py-2 font-body text-xs font-medium uppercase tracking-wide ${
                tab === c ? "border-b-2 border-[#37392d] text-ink" : "text-charcoal-mid"
              }`}
            >
              {c === "ATELIER" ? "Atelier" : "Bridal"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-body text-xs text-[#6B6B68]">{total} images</span>
          <button
            type="button"
            onClick={() => setReorder((r) => !r)}
            className={`border px-3 py-2 font-body text-[11px] uppercase tracking-wide ${
              reorder ? "border-[#37392d] bg-[#37392d] text-white" : "border-[#EBEBEA] text-charcoal"
            }`}
          >
            Reorder
          </button>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="bg-[#37392d] px-4 py-2 font-body text-[11px] font-medium uppercase tracking-wide text-white"
          >
            + Upload images
          </button>
        </div>
      </div>

      <div className="masonry-grid-admin">
        {images.map((img, idx) => (
          <div key={img.id} className="group masonry-item relative border border-[#EBEBEA] bg-[#fafafa]">
            <div className="relative aspect-[3/4] w-full overflow-hidden">
              <Image src={img.url} alt="" fill className="object-cover" sizes="200px" unoptimized />
              <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-2 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                <div className="flex justify-between">
                  {reorder ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="bg-canvas/90 p-1 text-charcoal"
                        onClick={() => void move(idx, -1)}
                        aria-label="Move up"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        className="bg-canvas/90 p-1 text-charcoal"
                        onClick={() => void move(idx, 1)}
                        aria-label="Move down"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    className="bg-canvas/90 p-1 text-charcoal"
                    onClick={() => void togglePublished(img)}
                    aria-label="Toggle published"
                  >
                    {img.isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="bg-canvas/90 p-1 text-charcoal"
                    onClick={() => {
                      setEditing(img);
                      setEditAlt(img.alt ?? "");
                      setEditCaption(img.caption ?? "");
                      setEditPublished(img.isPublished);
                      setEditSort(img.sortOrder);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <AlertDialog.Root>
                    <AlertDialog.Trigger asChild>
                      <button type="button" className="bg-canvas/90 p-1 text-red-700">
                        <Trash2 size={16} />
                      </button>
                    </AlertDialog.Trigger>
                    <AlertDialog.Portal>
                      <AlertDialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
                      <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 border border-[#EBEBEA] bg-canvas p-6 shadow-lg">
                        <AlertDialog.Title className="font-body text-sm font-medium">Delete image?</AlertDialog.Title>
                        <div className="mt-6 flex justify-end gap-2">
                          <AlertDialog.Cancel asChild>
                            <button type="button" className="border border-[#EBEBEA] px-4 py-2 text-xs uppercase">
                              Cancel
                            </button>
                          </AlertDialog.Cancel>
                          <AlertDialog.Action asChild>
                            <button
                              type="button"
                              className="bg-red-700 px-4 py-2 text-xs uppercase text-white"
                              onClick={() => void remove(img.id)}
                            >
                              Delete
                            </button>
                          </AlertDialog.Action>
                        </div>
                      </AlertDialog.Content>
                    </AlertDialog.Portal>
                  </AlertDialog.Root>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`min-w-[2rem] border px-2 py-1 font-body text-xs ${
                page === p ? "border-[#37392d] bg-[#37392d] text-white" : "border-[#EBEBEA] text-charcoal"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}

      <Dialog.Root
        open={uploadOpen}
        onOpenChange={(o) => {
          setUploadOpen(o);
          if (!o) {
            setUploadJobs([]);
            setUploadInFlight(false);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[min(90vh,640px)] w-[min(90vw,520px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-[#EBEBEA] bg-canvas p-6 shadow-lg">
            <Dialog.Title className="font-display text-xl text-ink">Upload images</Dialog.Title>
            <p className="mt-2 font-body text-xs text-[#6B6B68]">Uploading to: {tab === "ATELIER" ? "Atelier" : "Bridal"}</p>
            <label
              className="mt-6 flex cursor-pointer flex-col items-center justify-center border border-dashed border-[#EBEBEA] bg-[#fafafa] px-6 py-12 transition-colors hover:border-[#37392d]/40"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (uploadInFlight) return;
                const dt = e.dataTransfer.files;
                if (dt?.length) void onUploadFiles(dt);
              }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploadInFlight}
                className="hidden"
                onChange={(e) => {
                  void onUploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <span className="font-body text-sm text-charcoal">Drop files or click to select</span>
            </label>

            {uploadJobs.length > 0 ? (
              <ul className="mt-6 space-y-3 border-t border-[#EBEBEA] pt-4">
                {uploadJobs.map((job) => (
                  <li key={job.id} className="font-body text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-charcoal">{job.name}</span>
                      {job.status === "uploading" ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#37392d]" aria-hidden />
                      ) : null}
                      {job.status === "done" ? (
                        <span className="shrink-0 text-[#1B5E20]">Done</span>
                      ) : null}
                      {job.status === "error" ? (
                        <span className="shrink-0 text-red-700" title={job.error}>
                          Error
                        </span>
                      ) : null}
                      {job.status === "queued" ? (
                        <span className="shrink-0 text-[#A8A8A4]">Queued</span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden bg-[#EBEBEA]">
                      <div
                        className={`h-full transition-[width] duration-150 ${
                          job.status === "error" ? "bg-red-400" : "bg-[#37392d]"
                        }`}
                        style={{ width: `${job.status === "done" ? 100 : job.progress}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            <Dialog.Close asChild>
              <button
                type="button"
                disabled={uploadInFlight}
                className="mt-6 w-full border border-[#EBEBEA] py-2 text-xs uppercase disabled:opacity-50"
              >
                {uploadInFlight ? "Uploading…" : "Close"}
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
          <Dialog.Content className="fixed right-0 top-0 z-[101] flex h-full w-[min(100vw,380px)] flex-col border-l border-[#EBEBEA] bg-canvas p-6 shadow-lg">
            <Dialog.Title className="font-display text-lg">Edit image</Dialog.Title>
            <label className="mt-4 font-body text-[11px] uppercase text-[#6B6B68]">Alt</label>
            <input
              className="mt-1 border border-[#EBEBEA] px-3 py-2 text-sm"
              value={editAlt}
              onChange={(e) => setEditAlt(e.target.value)}
            />
            <label className="mt-4 font-body text-[11px] uppercase text-[#6B6B68]">Caption</label>
            <textarea
              className="mt-1 min-h-[80px] resize-y border border-[#EBEBEA] px-3 py-2 text-sm"
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
            />
            <label className="mt-4 flex items-center gap-2 font-body text-sm">
              <input type="checkbox" checked={editPublished} onChange={(e) => setEditPublished(e.target.checked)} />
              Published
            </label>
            <label className="mt-4 font-body text-[11px] uppercase text-[#6B6B68]">Sort order</label>
            <input
              type="number"
              className="mt-1 border border-[#EBEBEA] px-3 py-2 text-sm"
              value={editSort}
              onChange={(e) => setEditSort(parseInt(e.target.value, 10) || 0)}
            />
            <div className="mt-auto flex gap-2 pt-8">
              <Dialog.Close asChild>
                <button type="button" className="flex-1 border border-[#EBEBEA] py-2 text-xs uppercase">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void saveEdit()}
                className="flex-1 bg-[#37392d] py-2 text-xs uppercase text-white"
              >
                Save
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
