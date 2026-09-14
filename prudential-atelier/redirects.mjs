/** Permanent moves. Must be 301 — not Next.js page `redirect()` (that is a 200 shell + 307 digest). */
export const PERMANENT_REDIRECTS = [
  { source: "/legal/privacy", destination: "/privacy-policy", permanent: true },
  { source: "/legal/terms", destination: "/terms-and-conditions", permanent: true },
  { source: "/legal/returns", destination: "/returns-policy", permanent: true },
  { source: "/bespoke", destination: "/atelier", permanent: true },
  { source: "/bridesals", destination: "/bridal", permanent: true },
  { source: "/rtw/collections/:slug", destination: "/collections/:slug", permanent: true },
  { source: "/rtw/:slug", destination: "/shop/:slug", permanent: true },
  {
    source: "/rtw",
    has: [{ type: "query", key: "category", value: "ACCESSORIES" }],
    destination: "/shop?category=ACCESSORIES",
    permanent: true,
  },
  {
    source: "/rtw",
    has: [{ type: "query", key: "category", value: "KIDDIES" }],
    destination: "/shop?category=KIDDIES",
    permanent: true,
  },
];
