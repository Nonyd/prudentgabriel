/**
 * Storefront hero playback URL.
 * Cloudinary sources are forced to a capped H.264 MP4. Local WebM is rewritten
 * to a sibling MP4 — iPhone Safari cannot decode WebM in <video>.
 */
export function heroPlaybackUrl(url: string): string {
  let out = url.trim();
  const marker = "/video/upload/";
  const idx = out.indexOf(marker);
  if (idx >= 0) {
    const rest = out.slice(idx + marker.length);
    const slash = rest.indexOf("/");
    const first = slash >= 0 ? rest.slice(0, slash) : rest;
    const looksLikeTransform = /[,_=]/.test(first) && !/^v\d+$/.test(first);
    if (!looksLikeTransform) {
      out = out.replace(marker, `${marker}w_1080,c_limit,f_mp4,q_auto:eco,vc_h264/`);
    } else if (!/\bw_\d+/.test(first)) {
      out = out.replace(`${marker}${first}/`, `${marker}w_1080,c_limit,${first}/`);
    }
  }
  if (out.includes("/media/") && /\.webm(\?|#|$)/i.test(out)) {
    out = out.replace(/\.webm(\?|#|$)/i, ".mp4$1");
  }
  if (out.startsWith("/media/") && !out.includes("pgv=")) {
    out += out.includes("?") ? "&pgv=4" : "?pgv=4";
  }
  return out;
}

/** iPhone Safari treats a scripted play() as a failed gesture and then will not autoplay. */
export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}
