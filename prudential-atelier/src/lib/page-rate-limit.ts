import { headers } from "next/headers";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

/** Public token pages: 30 loads per IP per 15 minutes, per page type. */
export const TOKEN_PAGE_LIMIT = 30;
export const TOKEN_PAGE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Rate limit for server-rendered public token pages (which look tokens up
 * without going through an API route). Callers render `notFound()` when true,
 * so a guesser learns nothing from being throttled.
 */
export async function tokenPageRateLimited(bucket: string): Promise<boolean> {
  const ip = clientIpFromHeaders(await headers());
  return !(await checkRateLimit(`${bucket}:${ip}`, TOKEN_PAGE_LIMIT, TOKEN_PAGE_WINDOW_MS)).ok;
}
