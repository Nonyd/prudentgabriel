import { getMediaStore, keyFromMediaUrl } from "@/lib/media";
import { destroyCloudinaryAsset } from "@/lib/cloudinary-public-id";

/** Delete a local store object when the URL is ours; otherwise the Cloudinary asset. */
export async function destroyStoredMedia(url: string, publicId?: string | null): Promise<void> {
  const fromId =
    publicId && (publicId.startsWith("public/") || publicId.startsWith("private/")) ? publicId : null;
  const key = keyFromMediaUrl(url) ?? fromId;
  if (key) {
    await getMediaStore().delete(key);
    return;
  }
  await destroyCloudinaryAsset(url);
}
