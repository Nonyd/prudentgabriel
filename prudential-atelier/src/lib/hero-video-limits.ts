import { collectionReelEvenPx } from "@/lib/collection-reel-limits";

/** Match collection reels: 1080 across, 1920 tall. The RTW centre cell is a portrait frame. */
export const HERO_VIDEO_MAX_WIDTH = 1080;
export const HERO_VIDEO_MAX_HEIGHT = 1920;
export const MAX_HERO_VIDEO_MB = 12;
export const MAX_HERO_VIDEO_BYTES = MAX_HERO_VIDEO_MB * 1024 * 1024;
export const MAX_HERO_VIDEO_SOURCE_MB = 200;
export const MAX_HERO_VIDEO_SOURCE_BYTES = MAX_HERO_VIDEO_SOURCE_MB * 1024 * 1024;
export const MAX_HERO_VIDEO_SECONDS = 90;

export const HERO_VIDEO_SOURCE_TOO_LARGE_MESSAGE = `Hero clip must be under ${MAX_HERO_VIDEO_SOURCE_MB}MB`;
export const HERO_VIDEO_TOO_LARGE_MESSAGE = `Hero clip must compress to under ${MAX_HERO_VIDEO_MB}MB`;
export const HERO_VIDEO_TOO_LONG_MESSAGE = "Hero clip must be 1 minute 30 seconds or shorter";
export const HERO_VIDEO_SOURCE_TYPE_MESSAGE = "Use MP4, MOV, or WebM";
export const HERO_VIDEO_UNSUPPORTED_BROWSER_MESSAGE =
  "This browser cannot compress hero video. Use Chrome or Edge, or export an H.264 MP4 under 12MB.";

const SOURCE_MIME_OK = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]);

export function heroVideoSourceTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_HERO_VIDEO_SOURCE_BYTES;
}

export function heroVideoTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_HERO_VIDEO_BYTES;
}

export function heroVideoTooLong(durationSeconds: number): boolean {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
  return durationSeconds > MAX_HERO_VIDEO_SECONDS;
}

export function heroVideoSourceTypeOk(mime: string, fileName: string): boolean {
  if (mime && SOURCE_MIME_OK.has(mime.toLowerCase())) return true;
  return /\.(mp4|m4v|mov|webm)$/i.test(fileName);
}

export function heroVideoNeedsCompress(params: {
  sizeBytes: number;
  mime: string | null;
  width: number;
  height: number;
}): boolean {
  if (params.sizeBytes > MAX_HERO_VIDEO_BYTES) return true;
  if (params.mime !== "video/mp4") return true;
  if (params.width > HERO_VIDEO_MAX_WIDTH || params.height > HERO_VIDEO_MAX_HEIGHT) return true;
  return false;
}

/** Scale into 1080×1920 without upscaling. Landscape clips shrink to 1080 on the long edge. */
export function heroVideoOutputSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, HERO_VIDEO_MAX_WIDTH / width, HERO_VIDEO_MAX_HEIGHT / height);
  return {
    width: collectionReelEvenPx(width * scale),
    height: collectionReelEvenPx(height * scale),
  };
}

/** Muted hero loops — all of the budget can go to video. */
export function heroVideoTargetBitrate(durationSeconds: number): number {
  const dur = Math.max(1, Math.min(durationSeconds, MAX_HERO_VIDEO_SECONDS));
  const bits = MAX_HERO_VIDEO_BYTES * 0.92 * 8;
  return Math.max(700_000, Math.min(2_400_000, Math.floor(bits / dur)));
}
