import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth.config";
import { shouldBlockAtelierStorefront } from "@/lib/atelier-storefront";

const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "STAFF_ADMIN",
  "BESPOKE_MANAGER",
  "RTW_MANAGER",
  "CONTENT_MANAGER",
  "FINANCE_MANAGER",
  "HR_MANAGER",
  "CONSULTATION_MANAGER",
];

const MAINTENANCE_TTL_MS = 15_000;

type StorefrontFlags = { at: number; maintenance: boolean; atelierEnabled: boolean };

/** Per-isolate memo so HTML navigations do not hit the status route on every request. */
let storefrontMemo: StorefrontFlags | null = null;

/**
 * Fail-open for maintenance (keep the shop up). Fail-closed for atelier
 * (hide commissions if the flag cannot be read — RTW-first launch).
 */
async function getStorefrontFlags(request: NextRequest): Promise<{
  maintenance: boolean;
  atelierEnabled: boolean;
}> {
  const now = Date.now();
  if (storefrontMemo && now - storefrontMemo.at < MAINTENANCE_TTL_MS) {
    return { maintenance: storefrontMemo.maintenance, atelierEnabled: storefrontMemo.atelierEnabled };
  }

  try {
    const statusRes = await fetch(new URL("/api/maintenance-status", request.url), {
      headers: { Accept: "application/json" },
    });
    if (!statusRes.ok) {
      return {
        maintenance: storefrontMemo?.maintenance ?? false,
        atelierEnabled: storefrontMemo?.atelierEnabled ?? false,
      };
    }
    const body = (await statusRes.json()) as {
      enabled?: boolean;
      atelierStorefrontEnabled?: boolean;
    };
    const flags = {
      at: now,
      maintenance: body.enabled === true,
      atelierEnabled: body.atelierStorefrontEnabled === true,
    };
    storefrontMemo = flags;
    return { maintenance: flags.maintenance, atelierEnabled: flags.atelierEnabled };
  } catch {
    return {
      maintenance: storefrontMemo?.maintenance ?? false,
      atelierEnabled: storefrontMemo?.atelierEnabled ?? false,
    };
  }
}

export default auth(async function middleware(request) {
  const session = request.auth;
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    pathname.includes("favicon") ||
    pathname.includes(".") ||
    pathname.startsWith("/api/") ||
    pathname === "/maintenance" ||
    pathname === "/__storefront-hidden"
  ) {
    return NextResponse.next();
  }

  const role = (session?.user?.role as string | undefined) ?? "";
  const isAdminUser = ADMIN_ROLES.includes(role);
  const skipMaintenanceGate =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/admin-login") ||
    pathname.startsWith("/staff-login") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/accept-invite");

  if (!isAdminUser && !skipMaintenanceGate) {
    const flags = await getStorefrontFlags(request);
    if (flags.maintenance) {
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }
    if (shouldBlockAtelierStorefront(flags.atelierEnabled, pathname)) {
      return NextResponse.rewrite(new URL("/__storefront-hidden", request.url));
    }
  } else if (!pathname.startsWith("/admin") && !pathname.startsWith("/staff")) {
    const flags = await getStorefrontFlags(request);
    if (shouldBlockAtelierStorefront(flags.atelierEnabled, pathname)) {
      return NextResponse.rewrite(new URL("/__storefront-hidden", request.url));
    }
  }

  if (
    pathname === "/" ||
    pathname === "/admin-login" ||
    pathname === "/staff-login" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/about" ||
    pathname === "/contact" ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/track") ||
    pathname.startsWith("/quote") ||
    pathname.startsWith("/shop") ||
    pathname.startsWith("/consultation") ||
    pathname.startsWith("/journal") ||
    pathname.startsWith("/bespoke") ||
    pathname.startsWith("/atelier") ||
    pathname.startsWith("/rtw") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/bridal") ||
    pathname.startsWith("/kids") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/payment") ||
    pathname.startsWith("/attendance/qr") ||
    pathname.startsWith("/api/payments") ||
    pathname.startsWith("/api/products") ||
    pathname.startsWith("/api/blog") ||
    pathname.startsWith("/api/consultations") ||
    pathname.startsWith("/careers") ||
    pathname.startsWith("/size-guide")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/account")) {
    if (!session) {
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, request.url),
      );
    }
    if (session.user?.mustResetPassword && !pathname.startsWith("/reset-password")) {
      return NextResponse.redirect(new URL("/reset-password?required=true", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/staff")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login?tab=staff", request.url));
    }
    if (session.user?.mustResetPassword) {
      return NextResponse.redirect(new URL("/reset-password?required=true", request.url));
    }

    const role = (session.user?.role as string | undefined) ?? "";
    const isStaff = session.user?.isStaff === true;

    if (ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (!isStaff && role !== "STAFF") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("tab", "staff");
      loginUrl.searchParams.set("error", "no_staff_access");
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login?tab=admin", request.url));
    }

    const role = (session.user?.role as string | undefined) ?? "";

    if (!ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/login?tab=admin", request.url));
    }

    if (pathname.startsWith("/admin/settings/developer") && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (
      pathname.startsWith("/admin/system") &&
      role !== "SUPER_ADMIN" &&
      role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (
      pathname.startsWith("/admin/settings/users") &&
      role !== "SUPER_ADMIN" &&
      role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (
      pathname.startsWith("/admin/settings/roles") &&
      role !== "SUPER_ADMIN" &&
      role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (
      pathname.startsWith("/admin/careers") &&
      role !== "SUPER_ADMIN" &&
      role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (session.user?.mustResetPassword) {
      return NextResponse.redirect(new URL("/reset-password?required=true", request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|images/|icons/|.*\\..*).*)",
  ],
};
