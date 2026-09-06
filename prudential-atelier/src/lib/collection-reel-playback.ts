export const COLLECTION_REEL_MAX_PLAYING = 2;

export function shouldPrefetchReelVideo(opts: {
  withinOneViewport: boolean;
  saveData: boolean;
  reducedMotion: boolean;
}): boolean {
  if (opts.saveData || opts.reducedMotion) return false;
  return opts.withinOneViewport;
}

export function shouldAutoplayReel(opts: {
  inView: boolean;
  saveData: boolean;
  reducedMotion: boolean;
  tappedToPlay: boolean;
}): boolean {
  if (!opts.inView) return false;
  if (opts.saveData || opts.reducedMotion) return opts.tappedToPlay;
  return true;
}

/**
 * Keep at most `max` ids playing. Incoming `inViewIds` are preferred in order;
 * already-playing ids that are still in view keep their slot.
 */
export function pickPlayingReelIds(
  inViewIds: string[],
  currentlyPlaying: string[],
  max = COLLECTION_REEL_MAX_PLAYING,
): string[] {
  const inView = new Set(inViewIds);
  const kept = currentlyPlaying.filter((id) => inView.has(id)).slice(0, max);
  const keptSet = new Set(kept);
  for (const id of inViewIds) {
    if (kept.length >= max) break;
    if (keptSet.has(id)) continue;
    kept.push(id);
    keptSet.add(id);
  }
  return kept;
}

export function reelMediaSrc(keyOrUrl: string): string {
  const v = keyOrUrl.trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/media/")) return v;
  if (v.startsWith("public/")) return `/media/${v}`;
  return `/media/public/${v}`;
}
