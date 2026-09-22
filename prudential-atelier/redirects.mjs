/**
 * Permanent moves, served from next.config.mjs redirects(). `permanent: true`
 * answers 308 Permanent Redirect — Google treats 308 exactly like 301. Never use
 * a page-level `redirect()` for these (that is a 200 shell with a 307 digest).
 */
export const PERMANENT_REDIRECTS = [
  { source: "/legal/privacy", destination: "/privacy-policy", permanent: true },
  { source: "/legal/terms", destination: "/terms-and-conditions", permanent: true },
  { source: "/legal/returns", destination: "/returns-policy", permanent: true },
  { source: "/bespoke", destination: "/atelier", permanent: true },
  { source: "/bridesals", destination: "/bridal", permanent: true },
  { source: "/rtw/collections/:slug", destination: "/collections/:slug", permanent: true },
  { source: "/rtw/:slug", destination: "/shop/:slug", permanent: true },
  // Duplicated pieces published with placeholder slugs (renamed by migration 20260922_rename_def_slugs).
  { source: "/shop/def", destination: "/shop/delphinium-dress", permanent: true },
  { source: "/shop/def-copy", destination: "/shop/poppy-2-piece", permanent: true },
  { source: "/shop/def-copy-copy", destination: "/shop/camellia-dress", permanent: true },
  { source: "/shop/def-copy-copy-copy", destination: "/shop/primrose-dress", permanent: true },
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
