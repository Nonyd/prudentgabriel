import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { hasPermission, isAdminRole, isSuperAdmin } from "@/lib/roles";

const PUBLIC_PREFIXES = ["/track/", "/quote/", "/journal"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return pathname === "/journal";
}

function canAccessAdminPath(role: string | undefined, pathname: string, email?: string | null): boolean {
  if (!role || !isAdminRole(role)) return false;
  if (isSuperAdmin(role, email)) return true;
  if (role === "ADMIN" || role === "SUPER_ADMIN") return true;

  if (pathname.startsWith("/admin/bespoke")) {
    return hasPermission(role, "bespoke");
  }
  if (pathname.startsWith("/admin/staff")) {
    return hasPermission(role, "staff") || hasPermission(role, "staff.view");
  }
  if (pathname.startsWith("/admin/attendance")) {
    return hasPermission(role, "attendance");
  }
  if (pathname.startsWith("/admin/quotations")) {
    return hasPermission(role, "quotations");
  }
  if (pathname.startsWith("/admin/clients")) {
    return hasPermission(role, "clients") || hasPermission(role, "clients.view");
  }
  if (pathname.startsWith("/admin/content")) {
    return hasPermission(role, "content") || hasPermission(role, "content.blog");
  }
  if (pathname.startsWith("/admin/logs")) {
    return hasPermission(role, "logs");
  }
  if (pathname.startsWith("/admin/settings/developer")) {
    return false;
  }

  return isAdminRole(role);
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
    const allowed = role === "STAFF" || role === "ADMIN" || role === "SUPER_ADMIN";
    if (!allowed) {
      return NextResponse.redirect(new URL("/", nextUrl.origin));
    }
    return NextResponse.next();
  }

  const isAccountRoute = pathname.startsWith("/account");
  const isAdminRoute = pathname.startsWith("/admin");
  const isDeveloperSettings = pathname.startsWith("/admin/settings/developer");

  if (isAccountRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
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
  ],
};
