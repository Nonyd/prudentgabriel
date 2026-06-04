"use client";

import { useCallback, useState } from "react";
import { Bookmark, Share2 } from "lucide-react";
import toast from "react-hot-toast";

export function TrackOrderActions() {
  const [bookmarked, setBookmarked] = useState(false);

  const share = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Tracking link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }, []);

  return (
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex items-center gap-2 rounded-sm border border-choc bg-transparent px-6 py-3 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-choc transition-colors hover:bg-choc/5"
      >
        <Share2 className="h-3.5 w-3.5" />
        Share this link
      </button>
      <button
        type="button"
        onClick={() => {
          setBookmarked(true);
          toast.success("Bookmarked in this browser");
        }}
        className="inline-flex items-center gap-2 rounded-sm border border-choc bg-transparent px-6 py-3 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-choc transition-colors hover:bg-choc/5"
      >
        <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? "fill-choc" : ""}`} />
        Bookmark
      </button>
    </div>
  );
}
