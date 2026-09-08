export const MAX_COLLECTION_REEL_MB = 20;
export const MAX_COLLECTION_REEL_BYTES = MAX_COLLECTION_REEL_MB * 1024 * 1024;
export const MAX_COLLECTION_REEL_SOURCE_MB = 500;
export const MAX_COLLECTION_REEL_SOURCE_BYTES = MAX_COLLECTION_REEL_SOURCE_MB * 1024 * 1024;
export const MAX_COLLECTION_REEL_SECONDS = 90;
export const COLLECTION_REEL_MAX_WIDTH = 1080;
export const COLLECTION_REEL_MAX_HEIGHT = 1920;
export const COLLECTION_REEL_FOLDER = "prudential-atelier/collection-reels";
export const COLLECTION_REEL_TOO_LARGE_MESSAGE = `Reel must be under ${MAX_COLLECTION_REEL_MB}MB`;
export const COLLECTION_REEL_SOURCE_TOO_LARGE_MESSAGE = `Reel must be under ${MAX_COLLECTION_REEL_SOURCE_MB}MB`;
export const COLLECTION_REEL_TOO_LONG_MESSAGE = "Reel must be 1 minute 30 seconds or shorter";
export const COLLECTION_REEL_PORTRAIT_MESSAGE = "Reel must be portrait";
export const COLLECTION_REEL_SOURCE_TYPE_MESSAGE = "Use MP4, MOV, or WebM";
export const COLLECTION_REEL_UNSUPPORTED_BROWSER_MESSAGE =
  "This browser cannot compress reels. Use Chrome or Edge, or export an H.264 MP4 under 20MB.";
export const COLLECTION_REEL_SOURCE_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";
export const COLLECTION_REEL_GUIDE =
  `Portrait, up to 1 minute 30 seconds. Phone clips up to ${MAX_COLLECTION_REEL_SOURCE_MB}MB are compressed here to under ${MAX_COLLECTION_REEL_MB}MB.`;

export function collectionReelTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_COLLECTION_REEL_BYTES;
}

export function collectionReelSourceTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_COLLECTION_REEL_SOURCE_BYTES;
}

export function collectionReelTooLong(durationSeconds: number): boolean {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
  return durationSeconds > MAX_COLLECTION_REEL_SECONDS;
}

export function collectionReelDimensionsOk(width: number, height: number): boolean {
  if (width < 1 || height < 1) return false;
  if (width > COLLECTION_REEL_MAX_WIDTH || height > COLLECTION_REEL_MAX_HEIGHT) return false;
  return height / width >= 1.5;
}

/** Source clips may be 4K; they must still be portrait. */
export function collectionReelSourceDimensionsOk(width: number, height: number): boolean {
  if (width < 1 || height < 1) return false;
  return height / width >= 1.5;
}

export function collectionReelNeedsCompress(params: {
  sizeBytes: number;
  mime: string | null;
  width: number;
  height: number;
}): boolean {
  if (params.sizeBytes > MAX_COLLECTION_REEL_BYTES) return true;
  if (params.mime !== "video/mp4") return true;
  if (params.width > COLLECTION_REEL_MAX_WIDTH || params.height > COLLECTION_REEL_MAX_HEIGHT) return true;
  return false;
}

/** Video bitrate that should land a 1 minute 30 second clip under the stored 20MB cap with AAC audio. */
export function collectionReelTargetVideoBitrate(durationSeconds: number): number {
  const dur = Math.max(1, Math.min(durationSeconds, MAX_COLLECTION_REEL_SECONDS));
  const bits = MAX_COLLECTION_REEL_BYTES * 0.9 * 8;
  const audioBits = 96_000;
  return Math.max(700_000, Math.floor(bits / dur - audioBits));
}

const SOURCE_MIME_OK = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]);

export function collectionReelSourceTypeOk(mime: string, fileName: string): boolean {
  if (mime && SOURCE_MIME_OK.has(mime.toLowerCase())) return true;
  return /\.(mp4|m4v|mov|webm)$/i.test(fileName);
}

export function collectionReelEvenPx(n: number): number {
  const x = Math.max(2, Math.round(n));
  return x % 2 === 0 ? x : x - 1;
}

/** Scale a portrait clip into 1080×1920 without upscaling. */
export function collectionReelOutputSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, COLLECTION_REEL_MAX_WIDTH / width, COLLECTION_REEL_MAX_HEIGHT / height);
  return {
    width: collectionReelEvenPx(width * scale),
    height: collectionReelEvenPx(height * scale),
  };
}
