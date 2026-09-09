import { heroPlaybackUrl } from "@/lib/hero-playback";

const VIDEO_EXT = /\.(mp4|webm|mov)(\?|#|$)/i;

export function isGalleryVideoUrl(url: string): boolean {
  const v = url.trim();
  if (!v) return false;
  if (VIDEO_EXT.test(v)) return true;
  return v.includes("/video/upload/");
}

export function galleryPlaybackUrl(url: string): string {
  return heroPlaybackUrl(url);
}
