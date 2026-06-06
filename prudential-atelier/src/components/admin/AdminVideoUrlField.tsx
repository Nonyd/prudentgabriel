"use client";

import { useEffect, useRef, useState } from "react";
import { Film } from "lucide-react";
import toast from "react-hot-toast";
import { uploadAdminVideo } from "@/lib/admin-upload-xhr";
import { UploadProgressBar } from "@/components/admin/UploadProgressBar";

type AdminVideoUrlFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  folder: string;
};

export function AdminVideoUrlField({ label, value, onChange, folder }: AdminVideoUrlFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [broken, setBroken] = useState(false);
  const url = value.trim();
  const canPreview = url.length > 0;

  useEffect(() => {
    setBroken(false);
  }, [url]);

  const pickFile = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProgress(0);
    setBroken(false);
    try {
      const uploaded = await uploadAdminVideo(file, folder, (p) => setProgress(p));
      onChange(uploaded);
      toast.success("Video uploaded — URL filled in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div>
      <label className="font-body text-xs text-charcoal">{label}</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative flex h-28 w-full max-w-[220px] shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[#EBEBEA] bg-[#F5F5F3]">
          {canPreview && !broken ? (
            <video
              src={url}
              muted
              playsInline
              className="h-full w-full object-cover"
              onError={() => setBroken(true)}
            />
          ) : (
            <div className="flex flex-col items-center gap-1 px-2 text-center font-body text-[10px] leading-snug text-[#A8A8A4]">
              <Film className="h-5 w-5" />
              {canPreview && broken ? "Could not load preview" : "No preview yet"}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              className="min-w-0 flex-1 border border-[#EBEBEA] px-3 py-2 font-body text-sm"
              value={value}
              placeholder="Video URL (optional if uploading)"
              onChange={(e) => {
                setBroken(false);
                onChange(e.target.value);
              }}
            />
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              className="hidden"
              onChange={onFile}
            />
            <button
              type="button"
              disabled={progress !== null}
              onClick={pickFile}
              className="shrink-0 border border-[#37392d] bg-[#37392d] px-3 py-2 font-body text-[11px] font-medium uppercase tracking-wide text-white disabled:opacity-50"
            >
              {progress !== null ? "Uploading…" : "Upload"}
            </button>
          </div>
          <UploadProgressBar value={progress} />
          <p className="font-body text-[10px] text-[#A8A8A4]">
            MP4, WebM, or MOV · max 100MB · uploads directly to Cloudinary
          </p>
        </div>
      </div>
    </div>
  );
}
