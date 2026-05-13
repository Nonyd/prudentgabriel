export type UploadProgressHandler = (percent0to100: number) => void;

/**
 * POST multipart FormData with upload progress (same-origin cookies).
 * Response body must be JSON with at least `{ url: string }` on success.
 */
export function xhrPostFormData(
  path: string,
  formData: FormData,
  opts: { onProgress?: UploadProgressHandler; credentials?: boolean } = {},
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);
    xhr.withCredentials = opts.credentials ?? true;
    xhr.upload.onprogress = (ev) => {
      if (!opts.onProgress || !ev.lengthComputable) return;
      opts.onProgress(Math.min(100, Math.round((100 * ev.loaded) / ev.total)));
    };
    xhr.onload = () => {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(xhr.responseText || "{}") as Record<string, unknown>;
      } catch {
        reject(new Error("Invalid server response"));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const err = typeof body.error === "string" ? body.error : `Request failed (${xhr.status})`;
        reject(new Error(err));
        return;
      }
      resolve(body);
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

/** Cloudinary-backed admin image (or PDF when file is application/pdf). */
export async function uploadAdminAsset(
  file: File,
  folder: string,
  onProgress?: UploadProgressHandler,
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  if (file.type === "application/pdf") {
    fd.append("allowPdf", "true");
  }
  const body = await xhrPostFormData("/api/admin/upload", fd, { onProgress, credentials: true });
  const url = body.url;
  if (typeof url !== "string" || !url.length) {
    const err = typeof body.error === "string" ? body.error : "Upload failed";
    throw new Error(err);
  }
  return url;
}

/** Account area avatar upload (session cookie, fixed server folder). */
export async function uploadAccountImage(file: File, onProgress?: UploadProgressHandler): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const body = await xhrPostFormData("/api/account/upload", fd, { onProgress, credentials: true });
  const url = body.url;
  if (typeof url !== "string" || !url.length) {
    const err = typeof body.error === "string" ? body.error : "Upload failed";
    throw new Error(err);
  }
  return url;
}
