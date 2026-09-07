/** Human message when MediaStore.put fails on disk. */
export function mediaPutFailureMessage(e: unknown): string {
  const code =
    typeof e === "object" && e !== null && "code" in e ? String((e as { code?: unknown }).code) : "";
  if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
    return "The server cannot write this photo. Media storage permissions need fixing.";
  }
  if (code === "ENOSPC") {
    return "The server is out of disk space for photos.";
  }
  return "Upload failed";
}
