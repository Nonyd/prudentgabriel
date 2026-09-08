import {
  ADMIN_UPLOAD_TIMEOUT_MS,
  UPLOAD_ALLOW_VIDEO_HEADER,
  UPLOAD_FILENAME_HEADER,
  UPLOAD_FOLDER_HEADER,
} from "@/lib/admin-upload-headers";

export type UploadProgressHandler = (percent0to100: number) => void;

/** Admin video upload cap (same as POST /api/admin/upload). */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function uploadGatewayMessage(status: number, responseText: string): string {
  if (status === 413) return "This file is too large for the server.";
  if (status === 502 || status === 503 || status === 504) {
    return "The server dropped this upload before it finished saving. Try again.";
  }
  const snippet = responseText.slice(0, 120).replace(/\s+/g, " ").trim();
  return snippet
    ? `Invalid server response (${status}): ${snippet}`
    : `Invalid server response (${status})`;
}

function xhrSend(
  path: string,
  body: FormData | Blob,
  opts: { onProgress?: UploadProgressHandler; credentials?: boolean; headers?: Record<string, string> } = {},
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);
    xhr.withCredentials = opts.credentials ?? true;
    xhr.timeout = ADMIN_UPLOAD_TIMEOUT_MS;
    for (const [key, value] of Object.entries(opts.headers ?? {})) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (ev) => {
      if (!opts.onProgress || !ev.lengthComputable) return;
      opts.onProgress(Math.min(100, Math.round((100 * ev.loaded) / ev.total)));
    };
    xhr.onload = () => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(xhr.responseText || "{}") as Record<string, unknown>;
      } catch {
        reject(new Error(uploadGatewayMessage(xhr.status, xhr.responseText)));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const err = typeof parsed.error === "string" ? parsed.error : `Request failed (${xhr.status})`;
        reject(new Error(err));
        return;
      }
      resolve(parsed);
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Check your connection and try again."));
    xhr.send(body);
  });
}

/**
 * POST multipart FormData with upload progress (same-origin cookies).
 * Response body must be JSON with at least `{ url: string }` on success.
 */
export function xhrPostFormData(
  path: string,
  formData: FormData,
  opts: { onProgress?: UploadProgressHandler; credentials?: boolean } = {},
): Promise<Record<string, unknown>> {
  return xhrSend(path, formData, opts);
}

function uploadedUrl(body: Record<string, unknown>): string {
  const url = body.url;
  if (typeof url !== "string" || !url.length) {
    const err = typeof body.error === "string" ? body.error : "Upload failed";
    throw new Error(err);
  }
  return url;
}

/** Admin image (or PDF when file is application/pdf). */
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
  return uploadedUrl(await xhrPostFormData("/api/admin/upload", fd, { onProgress, credentials: true }));
}

/** Admin video upload (MP4, WebM, MOV). Magic bytes are checked on the server. */
export async function uploadAdminVideo(
  file: File,
  folder: string,
  onProgress?: UploadProgressHandler,
): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(`Video must be under ${MAX_VIDEO_BYTES / (1024 * 1024)}MB`);
  }
  return uploadedUrl(
    await xhrSend("/api/admin/upload", file, {
      onProgress,
      credentials: true,
      headers: {
        [UPLOAD_FOLDER_HEADER]: folder,
        [UPLOAD_ALLOW_VIDEO_HEADER]: "true",
        [UPLOAD_FILENAME_HEADER]: encodeURIComponent(file.name || "reel.mp4"),
      },
    }),
  );
}

/** Account area avatar upload (session cookie, fixed server folder). */
export async function uploadAccountImage(file: File, onProgress?: UploadProgressHandler): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  return uploadedUrl(await xhrPostFormData("/api/account/upload", fd, { onProgress, credentials: true }));
}
