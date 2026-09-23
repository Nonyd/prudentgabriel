"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { GalleryCategory, GalleryImage } from "@prisma/client";
import { priceGuideText } from "@/lib/price-guide";
import { duplicateFileOf, pieceGaps } from "@/lib/atelier-gallery";
import toast from "react-hot-toast";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Film,
  GripVertical,
  Loader2,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { isGalleryVideoUrl, galleryPlaybackUrl } from "@/lib/gallery-media";
import { cn } from "@/lib/utils";

type UploadJob = {
  id: string;
  name: string;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

type MediaFilter = "all" | "photos" | "videos" | "hidden" | "needs-guide" | "needs-description";

const CATEGORY_LABEL: Record<GalleryCategory, string> = {
  ATELIER: "Atelier",
  BRIDAL: "Bridal",
  KIDS: "Kids",
};

const ADMIN_GALLERY_LIMIT = 500;

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

async function fetchGallery(category: GalleryCategory) {
  const res = await fetch(`/api/admin/gallery?category=${category}&page=1&limit=${ADMIN_GALLERY_LIMIT}`);
  if (!res.ok) throw new Error("Failed to load");
  return (await res.json()) as {
    images: GalleryImage[];
    total: number;
    page: number;
    totalPages: number;
  };
}

function moveId(ids: string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

function applyOrder(items: GalleryImage[], orderedIds: string[]): GalleryImage[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return orderedIds.map((id) => byId.get(id)).filter((item): item is GalleryImage => Boolean(item));
}

/** "3,000,000" → 3000000 (digits only, whole naira); blank → null. */
function nairaOrNull(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

function mediaCaption(item: GalleryImage): string {
  const caption = item.caption?.trim();
  if (caption) return caption;
  const alt = item.alt?.trim();
  if (alt) return alt;
  return isGalleryVideoUrl(item.url) ? "Untitled film" : "Untitled look";
}

function AdminGalleryPreview({ item }: { item: GalleryImage }) {
  const video = isGalleryVideoUrl(item.url);
  const ref = useRef<HTMLVideoElement>(null);

  if (video) {
    return (
      <video
        ref={ref}
        src={galleryPlaybackUrl(item.url)}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-contain"
        onMouseEnter={() => void ref.current?.play().catch(() => undefined)}
        onMouseLeave={() => {
          const el = ref.current;
          if (!el) return;
          el.pause();
          el.currentTime = 0;
        }}
      />
    );
  }

  return (
    <Image
      src={item.url}
      alt={item.alt || ""}
      fill
      className="object-cover object-top"
      sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
      unoptimized
    />
  );
}

/** BB4: what an atelier tile is, and what it still needs, without opening it. */
function PieceStatus({
  position,
  gaps,
  frameOf,
  frameCount,
  duplicateOf,
}: {
  position: number;
  gaps: { needsPriceGuide: boolean; needsDescription: boolean };
  frameOf: string | null;
  frameCount: number;
  duplicateOf: number | null;
}) {
  const flag = "inline-block border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em]";
  const needs = "border-[#E0B872] bg-[#FFF6E5] text-[#8A5A00]";
  return (
    <div className="flex flex-wrap gap-1 font-body" data-piece-status>
      <span className={cn(flag, "border-sand text-[#6B6B68]")}>#{position}</span>
      {frameOf ? (
        <span className={cn(flag, "border-sand normal-case tracking-normal text-[#6B6B68]")}>Photo of {frameOf}</span>
      ) : (
        <>
          {frameCount > 0 ? (
            <span className={cn(flag, "border-sand text-[#6B6B68]")}>Piece · {frameCount + 1} photos</span>
          ) : null}
          {gaps.needsPriceGuide ? <span className={cn(flag, needs)}>No price guide</span> : null}
          {gaps.needsDescription ? <span className={cn(flag, needs)}>No description</span> : null}
        </>
      )}
      {duplicateOf ? (
        <span className={cn(flag, "border-[#E3A5A5] bg-[#FDEEEE] text-[#9B2C2C]")}>Same file as #{duplicateOf}</span>
      ) : null}
    </div>
  );
}

/** BA4: display-only price guide inputs, with the exact wording the page will show. */
function PriceGuideFields({
  floor,
  ceiling,
  onFloor,
  onCeiling,
}: {
  floor: string;
  ceiling: string;
  onFloor: (v: string) => void;
  onCeiling: (v: string) => void;
}) {
  const preview = priceGuideText({ priceFloorNGN: nairaOrNull(floor), priceCeilingNGN: nairaOrNull(ceiling) });
  return (
    <>
      <p className="mt-6 font-body text-[11px] uppercase text-[#6B6B68]">Price guide (display only)</p>
      <p className="mt-1 font-body text-xs text-[#6B6B68]">
        Shown beside the photograph as a reference, never charged. A floor alone is recommended; add a ceiling only if
        you want a range.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="font-body text-[11px] uppercase text-[#6B6B68]">
          From (₦)
          <input
            inputMode="numeric"
            className="mt-1 w-full border border-sand px-3 py-2 text-sm"
            value={floor}
            onChange={(e) => onFloor(e.target.value)}
            placeholder="3,000,000"
          />
        </label>
        <label className="font-body text-[11px] uppercase text-[#6B6B68]">
          Up to (₦, optional)
          <input
            inputMode="numeric"
            className="mt-1 w-full border border-sand px-3 py-2 text-sm"
            value={ceiling}
            onChange={(e) => onCeiling(e.target.value)}
          />
        </label>
      </div>
      {preview ? <p className="mt-2 font-body text-xs italic text-[#6B6B68]">Shows as: {preview}</p> : null}
    </>
  );
}

export function GalleryManager() {
  const [tab, setTab] = useState<GalleryCategory>("ATELIER");
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [uploadInFlight, setUploadInFlight] = useState(false);
  const [reorder, setReorder] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [editing, setEditing] = useState<GalleryImage | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editCaption, setEditCaption] = useState("");
  // BA4: display-only price guide (whole naira; blank = none).
  const [editFloor, setEditFloor] = useState("");
  const [editCeiling, setEditCeiling] = useState("");
  const [editPublished, setEditPublished] = useState(true);
  const [editCategory, setEditCategory] = useState<GalleryCategory>("ATELIER");
  // BB3: atelier pieces — a description on the main photograph, and which piece a frame belongs to.
  const [editDescription, setEditDescription] = useState("");
  const [editPieceOf, setEditPieceOf] = useState("");

  const load = useCallback(async () => {
    try {
      const j = await fetchGallery(tab);
      setItems(j.images);
      setTotal(j.total);
    } catch {
      toast.error("Could not load gallery");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIds([]);
    setSelectMode(false);
    setReorder(false);
    setFilter("all");
    setDragId(null);
    setDropId(null);
  }, [tab]);

  const photoCount = items.filter((item) => !isGalleryVideoUrl(item.url)).length;
  const videoCount = items.filter((item) => isGalleryVideoUrl(item.url)).length;
  const hiddenCount = items.filter((item) => !item.isPublished).length;

  // BB3/BB4: on the atelier tab a tile is a piece (its main photograph) or a frame of
  // one. What each piece still needs is on the tile; nobody opens pieces to find out.
  const pieceMode = tab === "ATELIER";
  const positionOf = useMemo(() => new Map(items.map((item, i) => [item.id, i + 1])), [items]);
  const duplicates = useMemo(() => duplicateFileOf(items), [items]);
  const heads = useMemo(() => items.filter((item) => !item.pieceOfId), [items]);
  const framesPerHead = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of items) if (item.pieceOfId) m.set(item.pieceOfId, (m.get(item.pieceOfId) ?? 0) + 1);
    return m;
  }, [items]);
  const needsGuideCount = heads.filter((item) => pieceGaps(item).needsPriceGuide).length;
  const needsDescriptionCount = heads.filter((item) => pieceGaps(item).needsDescription).length;
  const headLabel = (id: string) => {
    const head = items.find((item) => item.id === id);
    return head ? `#${positionOf.get(id) ?? "?"} ${mediaCaption(head)}` : "another piece";
  };

  const visible = useMemo(() => {
    return items.filter((item) => {
      const video = isGalleryVideoUrl(item.url);
      if (filter === "photos") return !video;
      if (filter === "videos") return video;
      if (filter === "hidden") return !item.isPublished;
      if (filter === "needs-guide") return pieceGaps(item).needsPriceGuide;
      if (filter === "needs-description") return pieceGaps(item).needsDescription;
      return true;
    });
  }, [items, filter]);

  const canDrag = reorder && filter === "all" && !selectMode && !savingOrder;

  const persistOrder = async (nextItems: GalleryImage[]) => {
    setSavingOrder(true);
    const res = await fetch("/api/admin/gallery/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: tab, orderedIds: nextItems.map((item) => item.id) }),
    });
    setSavingOrder(false);
    if (!res.ok) {
      toast.error("Reorder failed");
      void load();
      return;
    }
  };

  const dropOnto = (targetId: string) => {
    if (!canDrag || !dragId || dragId === targetId) {
      setDragId(null);
      setDropId(null);
      return;
    }
    const orderedIds = moveId(
      items.map((item) => item.id),
      dragId,
      targetId,
    );
    const next = applyOrder(items, orderedIds);
    setItems(next);
    setDragId(null);
    setDropId(null);
    void persistOrder(next);
  };

  const move = (id: string, dir: -1 | 1) => {
    if (!canDrag) return;
    const index = items.findIndex((item) => item.id === id);
    const j = index + dir;
    if (index < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    setItems(next);
    void persistOrder(next);
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
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      void load();
    }
  };

  const toggleImageSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const removeSelected = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(
      selectedIds.map((id) => fetch(`/api/admin/gallery/${id}`, { method: "DELETE" }).then((r) => ({ id, ok: r.ok }))),
    );
    setBulkDeleting(false);
    let ok = 0;
    let fail = 0;
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) ok += 1;
      else fail += 1;
    }
    setSelectedIds([]);
    setSelectMode(false);
    void load();
    if (fail === 0) toast.success(`${ok} ${ok === 1 ? "item" : "items"} removed`);
    else if (ok > 0) toast.error(`Removed ${ok}; ${fail} failed`);
    else toast.error("Delete failed");
  };

  const openEdit = (img: GalleryImage) => {
    setEditing(img);
    setEditAlt(img.alt ?? "");
    setEditCaption(img.caption ?? "");
    setEditFloor(img.priceFloorNGN ? String(img.priceFloorNGN) : "");
    setEditCeiling(img.priceCeilingNGN ? String(img.priceCeilingNGN) : "");
    setEditPublished(img.isPublished);
    setEditCategory(img.category);
    setEditDescription(img.description ?? "");
    setEditPieceOf(img.pieceOfId ?? "");
  };

  const editIsFrame = pieceMode && editCategory === "ATELIER" && Boolean(editPieceOf);

  const saveEdit = async () => {
    if (!editing) return;
    const res = await fetch(`/api/admin/gallery/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alt: editAlt || null,
        caption: editCaption || null,
        isPublished: editPublished,
        category: editCategory,
        // A frame's words and guide belong to its piece: send none, and the server
        // passes anything this photograph carried to the piece when it joins.
        ...(editIsFrame
          ? {}
          : {
              priceFloorNGN: nairaOrNull(editFloor),
              priceCeilingNGN: nairaOrNull(editCeiling),
              ...(pieceMode ? { description: editDescription.trim() || null } : {}),
            }),
        ...(pieceMode ? { pieceOfId: editPieceOf || null } : {}),
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: unknown };
      toast.error(typeof j.error === "string" ? j.error : "Save failed");
    } else {
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
        const jobId = jobs[i]!.id;
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
    if (ok > 0 && fail === 0) toast.success(`${ok} ${ok === 1 ? "file" : "files"} uploaded`);
    else if (ok > 0 && fail > 0) toast(`Finished with errors: ${ok} ok, ${fail} failed`, { icon: "⚠️" });
  };

  const allVisibleSelected =
    selectMode && visible.length > 0 && visible.every((item) => selectedIds.includes(item.id));
  const truncated = total > items.length;

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex gap-1 border-b border-sand">
          {(["ATELIER", "BRIDAL", "KIDS"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTab(c)}
              className={cn(
                "px-4 py-2 font-body text-xs font-medium uppercase tracking-wide",
                tab === c ? "border-b-2 border-[#37392d] text-ink" : "text-charcoal-mid",
              )}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-body text-xs text-[#6B6B68]">
            {photoCount} {photoCount === 1 ? "look" : "looks"}
            {videoCount > 0 ? ` · ${videoCount} ${videoCount === 1 ? "film" : "films"}` : ""}
            {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}
            {pieceMode && items.length > 0
              ? ` · ${heads.length} ${heads.length === 1 ? "piece" : "pieces"} · ${needsGuideCount} need a price guide · ${needsDescriptionCount} need a description`
              : ""}
          </span>
          <button
            type="button"
            onClick={() => {
              setReorder((r) => {
                const next = !r;
                if (next) {
                  setSelectMode(false);
                  setSelectedIds([]);
                  setFilter("all");
                }
                return next;
              });
            }}
            className={cn(
              "border px-3 py-2 font-body text-[11px] uppercase tracking-wide",
              reorder ? "border-[#37392d] bg-[#37392d] text-white" : "border-sand text-charcoal",
            )}
          >
            {savingOrder ? "Saving…" : "Reorder"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectMode((m) => {
                const next = !m;
                if (next) setReorder(false);
                if (!next) setSelectedIds([]);
                return next;
              });
            }}
            className={cn(
              "border px-3 py-2 font-body text-[11px] uppercase tracking-wide",
              selectMode ? "border-[#37392d] bg-[#37392d] text-white" : "border-sand text-charcoal",
            )}
          >
            Select
          </button>
          {selectMode && visible.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (allVisibleSelected) setSelectedIds([]);
                else setSelectedIds(visible.map((item) => item.id));
              }}
              className="border border-sand px-3 py-2 font-body text-[11px] uppercase tracking-wide text-charcoal"
            >
              {allVisibleSelected ? "Deselect all" : "Select all"}
            </button>
          ) : null}
          {selectMode && selectedIds.length > 0 ? (
            <AlertDialog.Root>
              <AlertDialog.Trigger asChild>
                <button
                  type="button"
                  disabled={bulkDeleting}
                  className="border border-red-800 bg-red-800 px-3 py-2 font-body text-[11px] uppercase tracking-wide text-white disabled:opacity-50"
                >
                  {bulkDeleting ? "Deleting…" : `Delete (${selectedIds.length})`}
                </button>
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
                <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 glass-3 glass-panel p-6">
                  <AlertDialog.Title className="font-body text-sm font-medium">
                    Delete {selectedIds.length} {selectedIds.length === 1 ? "item" : "items"}?
                  </AlertDialog.Title>
                  <p className="mt-2 font-body text-xs text-[#6B6B68]">This cannot be undone.</p>
                  <div className="mt-6 flex justify-end gap-2">
                    <AlertDialog.Cancel asChild>
                      <button type="button" className="border border-sand px-4 py-2 text-xs uppercase">
                        Cancel
                      </button>
                    </AlertDialog.Cancel>
                    <AlertDialog.Action asChild>
                      <button
                        type="button"
                        className="bg-red-700 px-4 py-2 text-xs uppercase text-white"
                        onClick={() => void removeSelected()}
                      >
                        Delete all
                      </button>
                    </AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          ) : null}
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="bg-[#37392d] px-4 py-2 font-body text-[11px] font-medium uppercase tracking-wide text-white"
          >
            + Upload
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All"],
            ["photos", "Photos"],
            ["videos", "Videos"],
            ["hidden", "Hidden"],
            ...(pieceMode
              ? ([
                  ["needs-guide", "Needs price guide"],
                  ["needs-description", "Needs description"],
                ] as const)
              : []),
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setFilter(id);
              if (id !== "all") setReorder(false);
            }}
            className={cn(
              "border px-3 py-1.5 font-body text-[11px] uppercase tracking-wide",
              filter === id ? "border-[#37392d] bg-[#37392d] text-white" : "border-sand text-charcoal",
            )}
          >
            {label}
            {id === "videos" && videoCount > 0 ? ` (${videoCount})` : ""}
            {id === "hidden" && hiddenCount > 0 ? ` (${hiddenCount})` : ""}
            {id === "needs-guide" ? ` (${needsGuideCount})` : ""}
            {id === "needs-description" ? ` (${needsDescriptionCount})` : ""}
          </button>
        ))}
      </div>

      {reorder ? (
        <p className="font-body text-xs text-[#6B6B68]">
          Drag a tile, or use the arrows, to set the public order. Films span two columns so they sit as film, not as
          postage stamps.
        </p>
      ) : filter !== "all" ? (
        <p className="font-body text-xs text-[#6B6B68]">Show all to reorder.</p>
      ) : null}

      {truncated ? (
        <p className="font-body text-xs text-[#6B6B68]">
          Showing the first {items.length} of {total}. Reorder after trimming this gallery.
        </p>
      ) : null}

      {loading ? (
        <p className="font-body text-sm text-[#6B6B68]">Loading gallery…</p>
      ) : visible.length === 0 ? (
        <p className="border border-dashed border-sand px-6 py-16 text-center font-body text-sm text-[#6B6B68]">
          {items.length === 0
            ? "No looks in this gallery yet. Upload photographs or film."
            : "Nothing matches this filter."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((img, idx) => {
            const video = isGalleryVideoUrl(img.url);
            const position = items.findIndex((item) => item.id === img.id) + 1;
            return (
              <article
                key={img.id}
                draggable={canDrag}
                onDragStart={(e) => {
                  if (!canDrag) return;
                  setDragId(img.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", img.id);
                }}
                onDragOver={(e) => {
                  if (!canDrag) return;
                  e.preventDefault();
                  if (dropId !== img.id) setDropId(img.id);
                }}
                onDragLeave={() => {
                  if (dropId === img.id) setDropId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOnto(img.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDropId(null);
                }}
                className={cn(
                  "group flex flex-col border bg-bg-card transition-[box-shadow,opacity] duration-150",
                  video ? "sm:col-span-2" : "",
                  canDrag ? "cursor-grab active:cursor-grabbing" : "",
                  dragId === img.id ? "opacity-50" : "opacity-100",
                  dropId === img.id && dragId && dragId !== img.id
                    ? "border-[#37392d] shadow-[0_0_0_1px_#37392d]"
                    : img.isPublished
                      ? "border-sand"
                      : "border-sand border-dashed",
                )}
              >
                <div
                  className={cn(
                    "relative overflow-hidden bg-[#1a1a18]",
                    video ? "aspect-video" : "aspect-[3/4]",
                  )}
                >
                  <AdminGalleryPreview item={img} />
                  {video ? (
                    <span
                      className={cn(
                        "pointer-events-none absolute top-2 inline-flex items-center gap-1 bg-[#37392d] px-2 py-1 font-body text-[10px] font-medium uppercase tracking-[0.12em] text-white",
                        selectMode && !reorder ? "left-8" : "left-2",
                      )}
                    >
                      <Film size={12} aria-hidden />
                      Video
                    </span>
                  ) : null}
                  {!img.isPublished ? (
                    <span className="pointer-events-none absolute right-2 top-2 bg-canvas/95 px-2 py-1 font-body text-[10px] uppercase tracking-[0.12em] text-charcoal">
                      Hidden
                    </span>
                  ) : null}
                  {video ? (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-90 transition-opacity duration-150 group-hover:opacity-0">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white">
                        <Play size={16} fill="currentColor" aria-hidden />
                      </span>
                    </span>
                  ) : null}
                  {reorder ? (
                    <span className="pointer-events-none absolute bottom-2 left-2 bg-canvas/95 px-1.5 py-0.5 font-body text-[10px] tabular-nums text-charcoal">
                      {position}
                    </span>
                  ) : null}
                  {selectMode && !reorder ? (
                    <>
                      <button
                        type="button"
                        className="absolute inset-0 z-[1] cursor-pointer border-0 bg-transparent p-0"
                        onClick={() => toggleImageSelected(img.id)}
                        aria-label={selectedIds.includes(img.id) ? "Deselect" : "Select"}
                      />
                      <label className="absolute left-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(img.id)}
                          onChange={() => toggleImageSelected(img.id)}
                          className="h-4 w-4 border-sand accent-[#37392d]"
                          aria-label={selectedIds.includes(img.id) ? "Deselect" : "Select"}
                        />
                      </label>
                    </>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 font-body text-[12px] leading-snug text-ink">
                      {mediaCaption(img)}
                      {!img.caption?.trim() && !img.alt?.trim() && !(pieceMode && img.pieceOfId) ? (
                        <span className="block text-[11px] text-[#A8A8A4]">Add a caption</span>
                      ) : null}
                    </p>
                    {canDrag ? (
                      <span className="mt-0.5 shrink-0 text-[#A8A8A4]" aria-hidden>
                        <GripVertical size={14} />
                      </span>
                    ) : null}
                  </div>
                  {pieceMode ? (
                    <PieceStatus
                      position={position}
                      gaps={pieceGaps(img)}
                      frameOf={img.pieceOfId ? headLabel(img.pieceOfId) : null}
                      frameCount={framesPerHead.get(img.id) ?? 0}
                      duplicateOf={duplicates.has(img.id) ? (positionOf.get(duplicates.get(img.id)!) ?? null) : null}
                    />
                  ) : duplicates.has(img.id) ? (
                    <span className="font-body text-[11px] text-[#9B2C2C]">
                      Same file as #{positionOf.get(duplicates.get(img.id)!)}
                    </span>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-1">
                    {canDrag ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="border border-sand p-1 text-charcoal disabled:opacity-30"
                          onClick={() => move(img.id, -1)}
                          disabled={idx === 0 || savingOrder}
                          aria-label="Move earlier"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="border border-sand p-1 text-charcoal disabled:opacity-30"
                          onClick={() => move(img.id, 1)}
                          disabled={idx === visible.length - 1 || savingOrder}
                          aria-label="Move later"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    ) : (
                      <span />
                    )}
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="border border-sand p-1 text-charcoal"
                        onClick={() => void togglePublished(img)}
                        aria-label={img.isPublished ? "Hide from public gallery" : "Publish"}
                      >
                        {img.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        type="button"
                        className="border border-sand p-1 text-charcoal"
                        onClick={() => openEdit(img)}
                        aria-label="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <AlertDialog.Root>
                        <AlertDialog.Trigger asChild>
                          <button type="button" className="border border-sand p-1 text-red-700" aria-label="Delete">
                            <Trash2 size={14} />
                          </button>
                        </AlertDialog.Trigger>
                        <AlertDialog.Portal>
                          <AlertDialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
                          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 glass-3 glass-panel p-6">
                            <AlertDialog.Title className="font-body text-sm font-medium">
                              Delete {video ? "this film" : "this look"}?
                            </AlertDialog.Title>
                            <div className="mt-6 flex justify-end gap-2">
                              <AlertDialog.Cancel asChild>
                                <button type="button" className="border border-sand px-4 py-2 text-xs uppercase">
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
              </article>
            );
          })}
        </div>
      )}

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
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[min(90vh,640px)] w-[min(90vw,520px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto glass-3 glass-panel p-6">
            <Dialog.Title className="font-display text-xl text-ink">Upload images or video</Dialog.Title>
            <p className="mt-2 font-body text-xs text-[#6B6B68]">
              Uploading to: {CATEGORY_LABEL[tab]}. Photos up to 5MB; MP4 or WebM up to 20MB.
            </p>
            <label
              className="mt-6 flex cursor-pointer flex-col items-center justify-center border border-dashed border-sand bg-[#fafafa] px-6 py-12 transition-colors hover:border-[#37392d]/40"
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
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,.mp4,.webm"
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
              <ul className="mt-6 space-y-3 border-t border-sand pt-4">
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
                        className={cn(
                          "h-full transition-[width] duration-150",
                          job.status === "error" ? "bg-red-400" : "bg-[#37392d]",
                        )}
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
                className="mt-6 w-full border border-sand py-2 text-xs uppercase disabled:opacity-50"
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
          <Dialog.Content className="fixed right-0 top-0 z-[101] flex h-full w-[min(100vw,400px)] flex-col border-l border-[var(--glass-edge)] glass-3 p-6">
            <Dialog.Title className="font-display text-lg">
              {editing && isGalleryVideoUrl(editing.url) ? "Edit film" : "Edit look"}
            </Dialog.Title>
            {editing ? (
              <div className="mt-4 overflow-hidden border border-sand bg-[#1a1a18]">
                {isGalleryVideoUrl(editing.url) ? (
                  <video
                    src={galleryPlaybackUrl(editing.url)}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full object-contain"
                  />
                ) : (
                  <div className="relative aspect-[3/4] w-full">
                    <Image src={editing.url} alt={editing.alt || ""} fill className="object-cover object-top" unoptimized />
                  </div>
                )}
              </div>
            ) : null}
            <label className="mt-4 font-body text-[11px] uppercase text-[#6B6B68]">Gallery</label>
            <select
              className="mt-1 border border-sand bg-white px-3 py-2 text-sm"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as GalleryCategory)}
            >
              {(["ATELIER", "BRIDAL", "KIDS"] as const).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <label className="mt-4 font-body text-[11px] uppercase text-[#6B6B68]">Alt</label>
            <input
              className="mt-1 border border-sand px-3 py-2 text-sm"
              value={editAlt}
              onChange={(e) => setEditAlt(e.target.value)}
            />
            <label className="mt-4 font-body text-[11px] uppercase text-[#6B6B68]">
              {pieceMode && !editIsFrame ? "Title (what the piece is called)" : "Caption"}
            </label>
            <textarea
              className="mt-1 min-h-[60px] resize-y border border-sand px-3 py-2 text-sm"
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
            />
            {pieceMode && editing && editCategory === "ATELIER" ? (
              <>
                <label className="mt-4 font-body text-[11px] uppercase text-[#6B6B68]">Piece</label>
                <select
                  className="mt-1 border border-sand bg-white px-3 py-2 text-sm"
                  value={editPieceOf}
                  onChange={(e) => setEditPieceOf(e.target.value)}
                >
                  <option value="">Its own piece (this is the main photograph)</option>
                  {heads
                    .filter((head) => head.id !== editing.id)
                    .map((head) => (
                      <option key={head.id} value={head.id}>
                        Another photograph of {headLabel(head.id)}
                      </option>
                    ))}
                </select>
                <p className="mt-1 font-body text-xs text-[#6B6B68]">
                  Several photographs of one gown are one piece. Choose the gown&apos;s main photograph here and they
                  show together on /atelier.
                </p>
              </>
            ) : null}
            {editIsFrame ? (
              <p className="mt-6 font-body text-xs text-[#6B6B68]">
                The description and price guide are set on the piece&apos;s main photograph ({headLabel(editPieceOf)}).
                Anything this photograph had moves there when you save, if the piece has none.
              </p>
            ) : (
              <>
                {pieceMode ? (
                  <>
                    <label className="mt-4 font-body text-[11px] uppercase text-[#6B6B68]">Description</label>
                    <textarea
                      className="mt-1 min-h-[110px] resize-y border border-sand px-3 py-2 text-sm"
                      value={editDescription}
                      maxLength={2000}
                      placeholder="What it is, what it is made of, what it was for."
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </>
                ) : null}
                <PriceGuideFields
                  floor={editFloor}
                  ceiling={editCeiling}
                  onFloor={setEditFloor}
                  onCeiling={setEditCeiling}
                />
              </>
            )}
            <label className="mt-4 flex items-center gap-2 font-body text-sm">
              <input type="checkbox" checked={editPublished} onChange={(e) => setEditPublished(e.target.checked)} />
              Published on the public page
            </label>
            <div className="mt-auto flex gap-2 pt-8">
              <Dialog.Close asChild>
                <button type="button" className="flex-1 border border-sand py-2 text-xs uppercase">
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
