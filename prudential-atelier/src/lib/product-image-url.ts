/** Thumbnail-friendly URLs for shop grid (reduces bandwidth vs full-size assets). */
export function optimizeProductCardImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("data:")) return url;

  if (url.includes("res.cloudinary.com")) {
    const marker = "/upload/";
    const idx = url.indexOf(marker);
    if (idx === -1) return url;
    const after = url.slice(idx + marker.length);
    if (/^(q_auto|f_auto|w_)/.test(after)) return url;
    return `${url.slice(0, idx + marker.length)}q_auto,f_auto,w_600,c_fill,g_top/${after.replace(/^\/+/, "")}`;
  }

  if (url.includes("images.unsplash.com")) {
    try {
      const u = new URL(url);
      if (!u.searchParams.has("w")) u.searchParams.set("w", "600");
      if (!u.searchParams.has("q")) u.searchParams.set("q", "80");
      return u.toString();
    } catch {
      return url;
    }
  }

  return url;
}

export const PRODUCT_IMAGE_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='1067' viewBox='0 0 800 1067'%3E%3Crect width='100%25' height='100%25' fill='%23F2F2F0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle' font-family='Georgia' font-size='14' fill='%23A8A8A4' letter-spacing='4'%3EPRUDENT GABRIEL%3C/text%3E%3C/svg%3E`;
