const KEY_RE = /^(public|private)\/[a-zA-Z0-9/_-]+\.[a-z0-9]+$/;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

export function extForMime(mime: string): string {
  return MIME_EXT[mime] ?? ".bin";
}

export function mimeForExt(ext: string): string {
  const e = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  const found = Object.entries(MIME_EXT).find(([, v]) => v === e);
  return found?.[0] ?? "application/octet-stream";
}

export function isValidMediaKey(key: string): boolean {
  if (!KEY_RE.test(key)) return false;
  if (key.includes("..") || key.includes("\\") || key.includes("\0")) return false;
  return true;
}

export function isPrivateMediaKey(key: string): boolean {
  return key.startsWith("private/");
}

/** Folder portion of a store key, e.g. `prudential-atelier/receipts`. */
export function folderFromMediaKey(key: string): string {
  const withoutVis = key.replace(/^(public|private)\//, "");
  const slash = withoutVis.lastIndexOf("/");
  return slash === -1 ? "" : withoutVis.slice(0, slash);
}

const MEDIA_PATH_RE = /\/media\/((?:public|private)\/[a-zA-Z0-9/_-]+\.[a-z0-9]+)/;

/** Extract a store key from a `/media/...` path or absolute URL. */
export function keyFromMediaUrl(url: string): string | null {
  if (!url) return null;
  if (isValidMediaKey(url)) return url;
  const pathOnly = url.startsWith("http")
    ? (() => {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      })()
    : url;
  const m = pathOnly.match(MEDIA_PATH_RE);
  if (m && isValidMediaKey(m[1])) return m[1];
  const stripped = pathOnly.replace(/^\/media\//, "");
  if (isValidMediaKey(stripped)) return stripped;
  return null;
}

export function originalNameMeta(raw: string | undefined): string {
  if (!raw || typeof raw !== "string") return "upload";
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "upload";
  return base.replace(/[^\w.\- ()]/g, "").slice(0, 180) || "upload";
}

export function extFromOriginalName(name: string): string {
  const slash = name.replace(/\\/g, "/").split("/").pop() ?? name;
  const i = slash.lastIndexOf(".");
  const e = i === -1 ? "" : slash.slice(i).toLowerCase();
  return e.length <= 8 ? e : "";
}
