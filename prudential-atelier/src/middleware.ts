import { NextResponse } from "next/server";
import { auth } from "@/lib/auth.config";
import { getPublicAppUrl } from "@/lib/app-url";

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

export default auth(async function middleware(request) {
  const session = request.auth;
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    pathname.includes("favicon") ||
    pathname.includes(".") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks") ||
    pathname === "/api/maintenance-status" ||
    pathname === "/maintenance"
  ) {
    return NextResponse.next();
  }

  const skipMaintenance =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/maintenance-status") ||
    pathname === "/admin-login" ||
    pathname === "/staff-login" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/maintenance";

  if (!skipMaintenance) {
    try {
      const maintenanceRes = await fetch(`${getPublicAppUrl()}/api/maintenance-status`, {
        cache: "no-store",
      });

      if (maintenanceRes.ok) {
        const { enabled } = (await maintenanceRes.json()) as { enabled?: boolean };

        if (enabled) {
          const role = session?.user?.role as string | undefined;
          const isAdmin = role && ADMIN_ROLES.includes(role);

          if (!isAdmin) {
            return NextResponse.rewrite(new URL("/maintenance", request.url));
          }
        }
      }
    } catch {
      // Fail open — never block on error
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
