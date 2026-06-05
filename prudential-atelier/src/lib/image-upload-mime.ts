/**
 * Normalize browser-reported MIME types and infer from extension when `type` is empty
 * (common on some Windows / picker combinations).
 */

const ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
};

function extToMime(ext: string, allowGif: boolean): string | null {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return allowGif ? "image/gif" : null;
    default:
      return null;
  }
}

export function resolveImageMimeType(
  reportedType: string,
  fileName: string | undefined,
  opts: { allowGif?: boolean } = {},
): string | null {
  const allowGif = opts.allowGif ?? false;
  let t = (reportedType || "").trim().toLowerCase();
  if (ALIASES[t]) t = ALIASES[t];

  if (!t && fileName) {
    const parts = fileName.split(".");
    const ext = parts.length > 1 ? parts.pop() ?? "" : "";
    const inferred = extToMime(ext, allowGif);
    if (inferred) return inferred;
  }

  const allowed = allowGif
    ? (["image/jpeg", "image/png", "image/webp", "image/gif"] as const)
    : (["image/jpeg", "image/png", "image/webp"] as const);

  return (allowed as readonly string[]).includes(t) ? t : null;
}

function videoExtToMime(ext: string): string | null {
  switch (ext.toLowerCase()) {
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    default:
      return null;
  }
}

export function resolveVideoMimeType(reportedType: string, fileName: string | undefined): string | null {
  const allowed = ["video/mp4", "video/webm", "video/quicktime"] as const;
  let t = (reportedType || "").trim().toLowerCase();

  if (!t && fileName) {
    const parts = fileName.split(".");
    const ext = parts.length > 1 ? parts.pop() ?? "" : "";
    const inferred = videoExtToMime(ext);
    if (inferred) return inferred;
  }

  return (allowed as readonly string[]).includes(t) ? t : null;
}
