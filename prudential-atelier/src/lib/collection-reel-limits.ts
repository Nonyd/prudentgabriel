export const MAX_COLLECTION_REEL_MB = 20;
export const MAX_COLLECTION_REEL_BYTES = MAX_COLLECTION_REEL_MB * 1024 * 1024;
export const MAX_COLLECTION_REEL_SECONDS = 60;
export const COLLECTION_REEL_MAX_WIDTH = 1080;
export const COLLECTION_REEL_MAX_HEIGHT = 1920;
export const COLLECTION_REEL_FOLDER = "prudential-atelier/collection-reels";
export const COLLECTION_REEL_TOO_LARGE_MESSAGE = `Reel must be under ${MAX_COLLECTION_REEL_MB}MB`;
export const COLLECTION_REEL_TOO_LONG_MESSAGE = "Reel must be 1 minute or shorter";
export const COLLECTION_REEL_GUIDE =
  `Export from your phone at 1080×1920, under ${MAX_COLLECTION_REEL_MB}MB, up to 1 minute.`;

export function collectionReelTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_COLLECTION_REEL_BYTES;
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
