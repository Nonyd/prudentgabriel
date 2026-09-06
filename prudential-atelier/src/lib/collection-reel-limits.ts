export const MAX_COLLECTION_REEL_BYTES = 10 * 1024 * 1024;
export const COLLECTION_REEL_MAX_WIDTH = 1080;
export const COLLECTION_REEL_MAX_HEIGHT = 1920;
export const COLLECTION_REEL_FOLDER = "prudential-atelier/collection-reels";
export const COLLECTION_REEL_GUIDE =
  "Export from your phone at 1080×1920, under 10MB, 15–30 seconds.";

export function collectionReelTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_COLLECTION_REEL_BYTES;
}

export function collectionReelDimensionsOk(width: number, height: number): boolean {
  if (width < 1 || height < 1) return false;
  if (width > COLLECTION_REEL_MAX_WIDTH || height > COLLECTION_REEL_MAX_HEIGHT) return false;
  return height / width >= 1.5;
}
