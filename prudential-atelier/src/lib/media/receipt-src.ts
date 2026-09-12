import { keyFromMediaUrl } from "@/lib/media/key-parse";
import { getMediaStore } from "@/lib/media";
import { absolutePublicUrl } from "@/lib/app-url";

export { adminReceiptSrc } from "@/lib/media/admin-receipt-src";

export const RECEIPT_EMAIL_TTL_SEC = 7 * 24 * 60 * 60;

/**
 * Href for a receipt in outbound email. Relative `/media/private/...` paths are
 * invalid in Gmail (they become `http:///media/...`). Private files are signed
 * so the image opens without an admin session.
 */
export function emailSafeReceiptUrl(storedUrl: string): string {
  const key = keyFromMediaUrl(storedUrl);
  if (key?.startsWith("private/")) {
    try {
      return absolutePublicUrl(getMediaStore().signedUrl(key, RECEIPT_EMAIL_TTL_SEC));
    } catch {
      return absolutePublicUrl(storedUrl.startsWith("/") ? storedUrl : `/${storedUrl}`);
    }
  }
  return absolutePublicUrl(storedUrl);
}
