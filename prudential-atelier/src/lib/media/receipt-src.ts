import { keyFromMediaUrl } from "@/lib/media/keys";

/** Admin lightbox / iframe src. Local private files go through the cookie-authenticated route. */
export function adminReceiptSrc(url: string | null | undefined): string {
  if (!url) return "";
  const key = keyFromMediaUrl(url);
  if (key && key.startsWith("private/")) {
    return `/api/admin/media/file/${key}`;
  }
  return url;
}
