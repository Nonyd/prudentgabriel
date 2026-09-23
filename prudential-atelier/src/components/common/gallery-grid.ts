/**
 * The lookbook grid from Slices M and S: edge to edge, photography only at rest,
 * hairline seams. One definition, used by the shop's gallery grid
 * (ProductCardGrid, variant "gallery") and the /atelier pieces (Slice BB2).
 *
 * A plain module, not "use client", so a server component gets the string.
 * It lives under src/components so Tailwind sees the class names.
 */
export const GALLERY_GRID_CLASS = "grid min-w-0 [&>*]:min-w-0";
export const GALLERY_GRID_SEAMS = "gap-px bg-white";
