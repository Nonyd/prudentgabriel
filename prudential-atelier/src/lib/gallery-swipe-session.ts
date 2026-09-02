/** In-memory only. Do not persist — Slice S is once per tab session. */

let nudgedThisSession = false;
let swipedThisSession = false;

export function markGallerySwipeUsed(): void {
  swipedThisSession = true;
}

export function gallerySwipeAlreadyUsed(): boolean {
  return swipedThisSession;
}

export function galleryNudgeStillAvailable(): boolean {
  return !nudgedThisSession && !swipedThisSession;
}

/** Returns true when the caller should play the hint. */
export function consumeGalleryNudge(reducedMotion = false): boolean {
  if (nudgedThisSession || swipedThisSession) return false;
  nudgedThisSession = true;
  return !reducedMotion;
}

/** Test helper. Not used in the storefront. */
export function resetGallerySwipeSessionForTests(): void {
  nudgedThisSession = false;
  swipedThisSession = false;
}