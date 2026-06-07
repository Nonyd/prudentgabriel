"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import toast from "react-hot-toast";
import { uploadAdminAsset } from "@/lib/admin-upload-xhr";
import { UploadProgressBar } from "@/components/admin/UploadProgressBar";

type AdminImageUrlFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  folder: string;
  /** File input accept attribute */
  accept?: string;
};

export function AdminImageUrlField({
  label,
  value,
  onChange,
  folder,
  accept = "image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
}: AdminImageUrlFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
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
      const uploaded = await uploadAdminAsset(file, folder, (p) => setProgress(p));
      onChange(uploaded);
      toast.success("Image uploaded — URL filled in");
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
        <div className="relative h-28 w-full max-w-[220px] shrink-0 overflow-hidden rounded-sm border border-sand bg-[#F5F5F3]">
          {canPreview && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN / user URLs
            <img src={url} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center font-body text-[10px] leading-snug text-[#A8A8A4]">
              {canPreview && broken ? "Could not load preview" : "No preview yet"}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              className="min-w-0 flex-1 border border-sand px-3 py-2 font-body text-sm"
              value={value}
              placeholder="Image URL"
              onChange={(e) => {
                setBroken(false);
                onChange(e.target.value);
              }}
            />
            <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onFile} />
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={progress !== null}
                onClick={pickFile}
                className="border border-[#37392d] bg-[#37392d] px-3 py-2 font-body text-[11px] font-medium uppercase tracking-wide text-white disabled:opacity-50"
              >
                {progress !== null ? "Uploading…" : "Upload"}
              </button>
              <Dialog.Root open={previewOpen} onOpenChange={setPreviewOpen}>
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    disabled={!canPreview}
                    className="border border-sand px-3 py-2 font-body text-[11px] font-medium uppercase tracking-wide text-charcoal disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Enlarge
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/50" />
                  <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] max-h-[90vh] w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 overflow-auto border border-sand bg-canvas p-5 shadow-lg">
                    <Dialog.Title className="font-body text-sm font-medium text-charcoal">Preview</Dialog.Title>
                    <div className="relative mx-auto mt-4 flex min-h-[200px] max-h-[70vh] w-full items-center justify-center bg-[#F5F5F3] p-2">
                      {canPreview && !broken ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="max-h-[65vh] w-auto max-w-full object-contain" />
                      ) : null}
                    </div>
                    <Dialog.Close asChild>
                      <button type="button" className="mt-4 w-full border border-sand py-2 font-body text-xs uppercase text-charcoal">
                        Close
                      </button>
                    </Dialog.Close>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          </div>
          <UploadProgressBar value={progress} />
        </div>
      </div>
    </div>
  );
}
