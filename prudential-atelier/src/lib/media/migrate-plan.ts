/** Classify a stored media URL for the Cloudinary → disk migration. */

export type MigrateAction = "copy" | "already-local" | "skip-remote" | "skip-empty";

export function classifyMediaUrl(url: string | null | undefined): {
  action: MigrateAction;
  reason?: string;
} {
  const u = (url ?? "").trim();
  if (!u) return { action: "skip-empty" };
  if (u.startsWith("/media/") || u.includes("/media/public/") || u.includes("/media/private/")) {
    return { action: "already-local" };
  }
  if (u.startsWith("/")) return { action: "skip-remote", reason: "site-local path" };
  if (u.includes("images.unsplash.com") || u.includes("unsplash.com")) {
    return { action: "skip-remote", reason: "Unsplash placeholder — not copied" };
  }
  if (u.includes("res.cloudinary.com")) return { action: "copy" };
  return { action: "skip-remote", reason: "unrecognised host" };
}

/** Folder + private flag from a Cloudinary delivery URL. */
export function folderFromCloudinaryUrl(url: string): { folder: string; private: boolean } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("cloudinary.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    let start = uploadIdx + 1;
    if (parts[start]?.match(/^v\d+$/)) start += 1;
    while (parts[start]?.includes(",")) start += 1;
    const rest = parts.slice(start);
    if (rest.length < 2) return { folder: "uploads", private: false };
    const folder = rest.slice(0, -1).join("/");
    const privateFolder =
      folder.includes("receipts") ||
      folder.includes("careers") ||
      folder.includes("consultations") ||
      folder.includes("moodboard");
    return { folder, private: privateFolder };
  } catch {
    return null;
  }
}
