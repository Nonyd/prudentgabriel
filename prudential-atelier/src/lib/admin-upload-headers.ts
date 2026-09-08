/** Same-origin headers for POST /api/admin/upload raw video bodies. */
export const UPLOAD_FOLDER_HEADER = "x-pg-folder";
export const UPLOAD_FILENAME_HEADER = "x-pg-filename";
export const UPLOAD_ALLOW_VIDEO_HEADER = "x-pg-allow-video";

/** Wall-clock XHR limit. Must outlast a 20MB reel on a slow admin connection. */
export const ADMIN_UPLOAD_TIMEOUT_MS = 600_000;
