export type UploadProgressHandler = (percent0to100: number) => void;

/** Cloudinary direct-upload limit (free tier). */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

type CloudinarySignResponse = {
  configured: boolean;
  devUrl?: string;
  cloudName?: string;
  apiKey?: string;
  timestamp?: number;
  signature?: string;
  folder?: string;
  resourceType?: "video" | "image";
};

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
        const snippet = xhr.responseText.slice(0, 120).replace(/\s+/g, " ");
        reject(
          new Error(
            snippet
              ? `Invalid server response (${xhr.status}): ${snippet}`
              : `Invalid server response (${xhr.status})`,
          ),
        );
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

async function fetchUploadSignature(
  folder: string,
  resourceType: "video" | "image",
): Promise<CloudinarySignResponse> {
  const res = await fetch("/api/admin/upload/sign", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder, resourceType }),
  });
  const body = (await res.json().catch(() => null)) as CloudinarySignResponse & { error?: string };
  if (!res.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : "Could not prepare upload");
  }
  return body;
}

function xhrUploadCloudinaryDirect(
  file: File,
  sign: Required<
    Pick<
      CloudinarySignResponse,
      "cloudName" | "apiKey" | "timestamp" | "signature" | "folder" | "resourceType"
    >
  >,
  onProgress?: UploadProgressHandler,
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", sign.apiKey);
  fd.append("timestamp", String(sign.timestamp));
  fd.append("signature", sign.signature);
  fd.append("folder", sign.folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (ev) => {
      if (!onProgress || !ev.lengthComputable) return;
      onProgress(Math.min(100, Math.round((100 * ev.loaded) / ev.total)));
    };
    xhr.onload = () => {
      let body: { secure_url?: string; error?: { message?: string } | string };
      try {
        body = JSON.parse(xhr.responseText || "{}") as typeof body;
      } catch {
        const snippet = xhr.responseText.slice(0, 120).replace(/\s+/g, " ");
        reject(
          new Error(
            snippet
              ? `Cloudinary upload failed (${xhr.status}): ${snippet}`
              : `Cloudinary upload failed (${xhr.status})`,
          ),
        );
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
        resolve(body.secure_url);
        return;
      }
      const cloudErr =
        typeof body.error === "string" ? body.error : body.error?.message;
      reject(new Error(cloudErr || `Cloudinary upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(fd);
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

/** Cloudinary-backed admin video upload (MP4, WebM, MOV) — direct to Cloudinary to bypass Vercel body limits. */
export async function uploadAdminVideo(
  file: File,
  folder: string,
  onProgress?: UploadProgressHandler,
): Promise<string> {
  const { resolveVideoMimeType } = await import("@/lib/image-upload-mime");
  const mime = resolveVideoMimeType(file.type, file.name);
  if (!mime) throw new Error("Only MP4, WebM, or MOV videos are allowed");
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(`Video must be under ${MAX_VIDEO_BYTES / (1024 * 1024)}MB`);
  }

  const sign = await fetchUploadSignature(folder, "video");
  if (!sign.configured) {
    return sign.devUrl ?? "https://res.cloudinary.com/demo/video/upload/sample.mp4";
  }

  const { cloudName, apiKey, timestamp, signature, resourceType } = sign;
  if (
    !cloudName ||
    !apiKey ||
    timestamp == null ||
    !signature ||
    !sign.folder ||
    !resourceType
  ) {
    throw new Error("Incomplete upload signature from server");
  }

  return xhrUploadCloudinaryDirect(
    file,
    {
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder: sign.folder,
      resourceType,
    },
    onProgress,
  );
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
