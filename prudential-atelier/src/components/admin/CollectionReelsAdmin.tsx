"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { uploadAdminAsset, uploadAdminVideo } from "@/lib/admin-upload-xhr";
import {
  COLLECTION_REEL_FOLDER,
  COLLECTION_REEL_GUIDE,
  collectionReelDimensionsOk,
  collectionReelTooLarge,
  MAX_COLLECTION_REEL_BYTES,
} from "@/lib/collection-reel-limits";
import { optimizeImageUrl } from "@/lib/utils";
import { UploadProgressBar } from "@/components/admin/UploadProgressBar";

type ReelRow = {
  id: string;
  videoKey: string;
  posterKey: string;
  position: number;
  productId: string | null;
  sortOrder: number;
  isActive: boolean;
  product?: { id: string; name: string; slug: string } | null;
};

function extractPosterBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    const cleanup = () => URL.revokeObjectURL(url);
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.12, (video.duration || 1) * 0.02);
      } catch {
        /* Safari */
      }
    };
    video.onseeked = () => {
      if (!collectionReelDimensionsOk(video.videoWidth, video.videoHeight)) {
        cleanup();
        reject(new Error("Reel must be portrait, at most 1080×1920"));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        reject(new Error("Could not extract poster"));
        return;
      }
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (!blob) reject(new Error("Could not extract poster"));
          else resolve(blob);
        },
        "image/jpeg",
        0.86,
      );
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not read the video"));
    };
  });
}

export function CollectionReelsAdmin({
  collectionId,
  products,
}: {
  collectionId: string;
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ReelRow[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [asHero, setAsHero] = useState(false);
  const [productId, setProductId] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const nextPosition = useMemo(() => {
    const used = items.filter((r) => r.position > 0).map((r) => r.position);
    for (const slot of [3, 8, 14, 20, 26]) {
      if (!used.includes(slot)) return slot;
    }
    return (Math.max(0, ...used) || 3) + 6;
  }, [items]);

  async function refresh() {
    const res = await fetch(`/api/admin/collections/${collectionId}/reels`);
    if (!res.ok) return;
    const data = (await res.json()) as { items: ReelRow[] };
    setItems(data.items);
  }

  useEffect(() => {
    void refresh();
  }, [collectionId]);

  async function persistOrder(ids: string[]) {
    const res = await fetch(`/api/admin/collections/${collectionId}/reels`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ids }),
    });
    if (!res.ok) toast.error("Could not reorder reels");
    else router.refresh();
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (collectionReelTooLarge(file.size)) {
      toast.error("Reel must be under 10MB");
      return;
    }
    if (file.type && file.type !== "video/mp4") {
      toast.error("Reels must be H.264 MP4");
      return;
    }
    setProgress(0);
    try {
      const posterBlob = await extractPosterBlob(file);
      const posterFile = new File([posterBlob], "poster.jpg", { type: "image/jpeg" });
      const videoUrl = await uploadAdminVideo(file, COLLECTION_REEL_FOLDER, (p) => setProgress(Math.min(70, p * 0.7)));
      const posterUrl = await uploadAdminAsset(posterFile, COLLECTION_REEL_FOLDER, (p) =>
        setProgress(70 + Math.round(p * 0.3)),
      );
      const res = await fetch(`/api/admin/collections/${collectionId}/reels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoKey: videoUrl,
          posterKey: posterUrl,
          position: asHero ? 0 : nextPosition,
          productId: productId || null,
          isActive: true,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(typeof body.error === "string" ? body.error : "Could not save reel");
      }
      toast.success("Reel added");
      setAsHero(false);
      setProductId("");
      await refresh();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  };

  async function remove(id: string) {
    const res = await fetch(`/api/admin/collections/${collectionId}/reels/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Could not remove reel");
    else {
      toast.success("Removed");
      await refresh();
      router.refresh();
    }
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-xl text-ink">Reels</h2>
      <p className="mt-1 font-body text-[12px] text-[#6B6B68]">{COLLECTION_REEL_GUIDE}</p>
      <p className="mt-1 font-body text-[12px] text-[#6B6B68]">
        Cap {MAX_COLLECTION_REEL_BYTES / (1024 * 1024)}MB, 1080×1920, H.264 MP4. A poster is taken from the first frame if
        you do not upload one.
      </p>

      <div className="admin-solid-panel mt-4 space-y-4 border border-sand bg-bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 font-body text-[12px] text-ink">
            <input type="checkbox" checked={asHero} onChange={(e) => setAsHero(e.target.checked)} />
            Use as hero
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="border border-sand bg-white px-2 py-1.5 font-body text-[12px]"
          >
            <option value="">No product link</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="admin-cta font-body text-[11px]"
          >
            Upload reel
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,.mp4"
            className="hidden"
            onChange={(e) => void onFile(e)}
          />
        </div>
        {progress != null ? <UploadProgressBar value={progress} /> : null}

        <ul className="divide-y divide-[#EBEBEA] border border-sand">
          {items.length === 0 ? (
            <li className="px-3 py-4 font-body text-[13px] text-[#6B6B68]">No reels yet.</li>
          ) : (
            items.map((row) => (
              <li
                key={row.id}
                draggable
                onDragStart={() => setDragId(row.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (!dragId || dragId === row.id) return;
                  const from = items.findIndex((r) => r.id === dragId);
                  const to = items.findIndex((r) => r.id === row.id);
                  if (from < 0 || to < 0) return;
                  const next = [...items];
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved!);
                  setItems(next);
                  setDragId(null);
                  void persistOrder(next.map((r) => r.id));
                }}
                className="flex cursor-grab items-center gap-3 px-3 py-3"
              >
                <div className="relative h-16 w-10 shrink-0 overflow-hidden bg-[#F2F2F0]">
                  {row.posterKey ? (
                    <Image src={optimizeImageUrl(row.posterKey, 120)} alt="" fill className="object-cover" sizes="40px" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[13px] text-ink">
                    {row.position === 0 ? "Hero" : `After piece ${row.position}`}
                    {row.product?.name ? ` · ${row.product.name}` : ""}
                  </p>
                  <p className="font-body text-[11px] text-[#6B6B68]">{row.isActive ? "Active" : "Hidden"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(row.id)}
                  className="font-body text-[11px] uppercase text-red-700"
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
