/** Extract Cloudinary public_id from a secure_url (without file extension). */
export function publicIdFromCloudinaryUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("cloudinary.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    let start = uploadIdx + 1;
    if (parts[start]?.match(/^v\d+$/)) start += 1;
    const withExt = parts.slice(start).join("/");
    if (!withExt) return null;
    return withExt.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
}

export async function destroyCloudinaryAsset(url: string): Promise<void> {
  const publicId = publicIdFromCloudinaryUrl(url);
  if (!publicId || publicId.startsWith("dev-") || publicId.startsWith("seed-")) return;
  const { cloudinary } = await import("@/lib/cloudinary");
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (e) {
    console.warn("[cloudinary destroy]", publicId, e);
  }
}
