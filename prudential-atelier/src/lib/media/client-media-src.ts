import { keyFromMediaUrl } from "@/lib/media/key-parse";
import { getMediaStore } from "@/lib/media";

/** Long enough for a page left open through a session, short enough not to be a standing link. */
export const CLIENT_MEDIA_TTL_SEC = 2 * 60 * 60;

/**
 * Src for a client's own private picture (moodboard, reference image) on her
 * account pages. /media/private/... answers only to the portal, so her own
 * files are handed to her as short-lived signed links instead.
 *
 * Call this only with URLs read from records already scoped to the signed-in
 * client (her booking, enquiry or commission): the signature is the permission.
 */
export function clientMediaSrc(storedUrl: string): string {
  const key = keyFromMediaUrl(storedUrl);
  if (!key?.startsWith("private/")) return storedUrl;
  try {
    return getMediaStore().signedUrl(key, CLIENT_MEDIA_TTL_SEC);
  } catch {
    return storedUrl;
  }
}

export function clientMediaSrcs(urls: readonly string[] | null | undefined): string[] {
  return (urls ?? []).map(clientMediaSrc);
}
