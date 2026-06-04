import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  canAccessLogs,
  canAccessReports,
  canAccessSettings,
  hasPermission,
  isAdminRole,
  isSuperAdmin,
} from "@/lib/roles";

const PUBLIC_PREFIXES = ["/track/", "/quote/", "/journal"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return pathname === "/journal";
}

function canAccessAdminPath(role: string | undefined, pathname: string, email?: string | null): boolean {
  if (!role || !isAdminRole(role)) return false;
  if (isSuperAdmin(role, email)) return true;

  if (pathname.startsWith("/admin/account-settings")) {
    return isAdminRole(role);
  }

  if (pathname.startsWith("/admin/settings/developer")) {
    return false;
  }

  if (pathname.startsWith("/admin/logs")) {
    return canAccessLogs(role, email);
  }

  if (pathname.startsWith("/admin/reports")) {
    return canAccessReports(role, email);
  }

  if (pathname.startsWith("/admin/settings")) {
    return canAccessSettings(role, email);
  }

  if (pathname === "/admin") {
    return hasPermission(role, "dashboard");
  }

  if (pathname.startsWith("/admin/bespoke")) {
    return hasPermission(role, "bespoke");
  }
  if (pathname.startsWith("/admin/consultations")) {
    return hasPermission(role, "consultations");
  }
  if (pathname.startsWith("/admin/invoices") || pathname.startsWith("/admin/quotations")) {
    return hasPermission(role, "invoices") || hasPermission(role, "quotations");
  }
  if (
    pathname.startsWith("/admin/products") ||
    pathname.startsWith("/admin/collections") ||
    pathname.startsWith("/admin/coupons")
  ) {
    return hasPermission(role, "shop") || hasPermission(role, "shop.products");
  }
  if (pathname.startsWith("/admin/orders")) {
    return hasPermission(role, "shop") || hasPermission(role, "shop.orders");
  }
  if (pathname.startsWith("/admin/payments")) {
    return hasPermission(role, "finance") || hasPermission(role, "payments");
  }
  if (pathname.startsWith("/admin/clients") || pathname.startsWith("/admin/customers")) {
    return hasPermission(role, "clients") || hasPermission(role, "clients.view");
  }
  if (pathname.startsWith("/admin/staff") || pathname.startsWith("/admin/team")) {
    return hasPermission(role, "staff") || hasPermission(role, "staff.view");
  }
  if (pathname.startsWith("/admin/attendance") || pathname.startsWith("/admin/clock-in")) {
    return hasPermission(role, "attendance");
  }
  if (pathname.startsWith("/admin/content") || pathname.startsWith("/admin/gallery")) {
    return (
      hasPermission(role, "content") ||
      hasPermission(role, "content.blog") ||
      hasPermission(role, "content.pages")
    );
  }
  if (pathname.startsWith("/admin/import") || pathname.startsWith("/admin/reviews")) {
    return hasPermission(role, "shop") || hasPermission(role, "content");
  }
  if (pathname.startsWith("/admin/notifications") || pathname.startsWith("/admin/referrals")) {
    return hasPermission(role, "clients") || hasPermission(role, "settings");
  }

  if (role === "ADMIN") return true;

  return false;
}

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const pathname = nextUrl.pathname;
  const isLoggedIn = !!session;
  const role = session?.user?.role;
  const email = session?.user?.email;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/clock-in")) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    const allowed =
      role === "STAFF" ||
      role === "ADMIN" ||
      role === "SUPER_ADMIN" ||
      role === "STAFF_ADMIN" ||
      (typeof role === "string" && role.endsWith("_MANAGER"));
    if (!allowed) {
      return NextResponse.redirect(new URL("/", nextUrl.origin));
    }
    return NextResponse.next();
  }

  const isAccountRoute = pathname.startsWith("/account");
  const isAdminRoute = pathname.startsWith("/admin");
  const isDeveloperSettings = pathname.startsWith("/admin/settings/developer");

  if ((isAccountRoute || pathname === "/reset-password") && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    isLoggedIn &&
    session?.user?.mustResetPassword &&
    pathname !== "/reset-password" &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/auth/reset-password")
  ) {
    const resetUrl = new URL("/reset-password", nextUrl.origin);
    resetUrl.searchParams.set("required", "true");
    return NextResponse.redirect(resetUrl);
  }

  if (isDeveloperSettings) {
    if (!isLoggedIn || !isSuperAdmin(role, email)) {
      return new NextResponse(null, { status: 404 });
    }
  }

  if (isAdminRoute) {
    if (!isLoggedIn || !canAccessAdminPath(role, pathname, email)) {
      return NextResponse.redirect(new URL("/admin-login", nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/account/:path*",
    "/admin",
    "/admin/:path*",
    "/clock-in",
    "/track/:path*",
    "/quote/:path*",
    "/journal",
    "/journal/:path*",
    "/reset-password",
  ],
};
