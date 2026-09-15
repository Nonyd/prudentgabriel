const EXCLUDED_PREFIXES = [
  "/admin",
  "/staff",
  "/api",
  "/login",
  "/register",
  "/admin-login",
  "/staff-login",
  "/auth",
  "/accept-invite",
  "/reset-password",
  "/unsubscribe",
  "/track",
  "/quote",
  "/approve",
  "/invoice",
  "/receipt",
  "/checkout/restore",
  "/ref",
  "/maintenance",
  "/_next",
  "/images",
  "/icons",
];

export function normalizePath(raw: string): string {
  let path = raw.split("?")[0]?.split("#")[0] ?? "";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  path = path.replace(/\/{2,}/g, "/");
  return path.slice(0, 200) || "/";
}

export function isExcludedPath(path: string): boolean {
  const p = normalizePath(path).toLowerCase();
  if (p.includes(".")) return true;
  return EXCLUDED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export function isRtwAislePath(path: string): boolean {
  const p = normalizePath(path);
  return (
    p === "/rtw" ||
    p === "/shop" ||
    p === "/bridal" ||
    p === "/kids" ||
    p === "/collections" ||
    p === "/bridesals" ||
    p.startsWith("/rtw/collections/") ||
    p.startsWith("/collections/")
  );
}

export function isProductPath(path: string): boolean {
  const p = normalizePath(path);
  if (p.startsWith("/rtw/collections/")) return false;
  if (p === "/shop" || p === "/rtw") return false;
  return /^\/shop\/[^/]+$/.test(p) || /^\/rtw\/[^/]+$/.test(p);
}

export function isAtelierPath(path: string): boolean {
  const p = normalizePath(path);
  return p === "/atelier" || p === "/bespoke";
}

export function isConsultationPagePath(path: string): boolean {
  const p = normalizePath(path);
  return p === "/consultation";
}

export const ANALYTICS_DAILY_RETENTION_KEY = "analytics_daily_retention_days";
export const ANALYTICS_DAILY_RETENTION_DEFAULT = 90;
