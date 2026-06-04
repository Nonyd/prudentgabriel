import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import {
  getJobPermissionsForAdminPath,
  hasAnyPermission,
  shouldEnforceJobPermissions,
  type PermissionSession,
} from "@/lib/permissions";
import {
  canAccessLogs,
  canAccessReports,
  canAccessSettings,
  hasPermission as hasRolePermission,
  isAdminRole,
  isSuperAdmin,
} from "@/lib/roles";

const PUBLIC_PREFIXES = ["/track/", "/quote/", "/journal"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return pathname === "/journal";
}

function toPermissionSession(session: Session | null | undefined): PermissionSession {
  if (!session?.user) return null;
  return {
    user: {
      role: session.user.role,
      jobRolePermissions: session.user.jobRolePermissions,
    },
  };
}

function canAccessAdminPathLegacy(role: string | undefined, pathname: string, email?: string | null): boolean {
  if (!role || !isAdminRole(role)) return false;
  if (isSuperAdmin(role, email)) return true;

  if (pathname.startsWith("/admin/account-settings")) {
    return isAdminRole(role);
  }

  if (pathname.startsWith("/admin/settings/developer")) {
    return false;
  }

  if (pathname.startsWith("/admin/settings/users")) {
    return false;
  }

  if (pathname.startsWith("/admin/settings/roles")) {
    return role === "ADMIN" || isSuperAdmin(role, email);
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
    return hasRolePermission(role, "dashboard");
  }

  if (pathname.startsWith("/admin/bespoke")) {
    return hasRolePermission(role, "bespoke");
  }
  if (pathname.startsWith("/admin/consultations")) {
    return hasRolePermission(role, "consultations");
  }
  if (pathname.startsWith("/admin/invoices") || pathname.startsWith("/admin/quotations")) {
    return hasRolePermission(role, "invoices") || hasRolePermission(role, "quotations");
  }
  if (
    pathname.startsWith("/admin/products") ||
    pathname.startsWith("/admin/collections") ||
    pathname.startsWith("/admin/coupons")
  ) {
    return hasRolePermission(role, "shop") || hasRolePermission(role, "shop.products");
  }
  if (pathname.startsWith("/admin/orders")) {
    return hasRolePermission(role, "shop") || hasRolePermission(role, "shop.orders");
  }
  if (pathname.startsWith("/admin/payments")) {
    return hasRolePermission(role, "finance") || hasRolePermission(role, "payments");
  }
  if (pathname.startsWith("/admin/clients") || pathname.startsWith("/admin/customers")) {
    return hasRolePermission(role, "clients") || hasRolePermission(role, "clients.view");
  }
  if (pathname.startsWith("/admin/staff") || pathname.startsWith("/admin/team")) {
    return hasRolePermission(role, "staff") || hasRolePermission(role, "staff.view");
  }
  if (pathname.startsWith("/admin/attendance") || pathname.startsWith("/admin/clock-in")) {
    return hasRolePermission(role, "attendance");
  }
  if (pathname.startsWith("/admin/content") || pathname.startsWith("/admin/gallery")) {
    return (
      hasRolePermission(role, "content") ||
      hasRolePermission(role, "content.blog") ||
      hasRolePermission(role, "content.pages")
    );
  }
  if (pathname.startsWith("/admin/import") || pathname.startsWith("/admin/reviews")) {
    return hasRolePermission(role, "shop") || hasRolePermission(role, "content");
  }
  if (pathname.startsWith("/admin/notifications") || pathname.startsWith("/admin/referrals")) {
    return hasRolePermission(role, "clients") || hasRolePermission(role, "settings");
  }

  if (role === "ADMIN") return true;

  return false;
}

function canAccessAdminPath(
  session: Session | null | undefined,
  pathname: string,
  email?: string | null,
): boolean {
  const role = session?.user?.role;
  if (!canAccessAdminPathLegacy(role, pathname, email)) return false;

  const permissionSession = toPermissionSession(session);
  if (!shouldEnforceJobPermissions(permissionSession)) return true;

  const jobKeys = getJobPermissionsForAdminPath(pathname);
  if (!jobKeys || jobKeys.length === 0) return true;

  return hasAnyPermission(permissionSession, jobKeys);
}

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const pathname = nextUrl.pathname;
  const isLoggedIn = !!session;
  const role = session?.user?.role;
  const email = session?.user?.email;
  const isStaff = Boolean(session?.user?.isStaff);

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
      isStaff ||
      (typeof role === "string" && role.endsWith("_MANAGER"));
    if (!allowed) {
      return NextResponse.redirect(new URL("/", nextUrl.origin));
    }
    return NextResponse.next();
  }

  const isAccountRoute = pathname.startsWith("/account");
  const isAdminRoute = pathname.startsWith("/admin");
  const isStaffRoute = pathname.startsWith("/staff");
  const isDeveloperSettings = pathname.startsWith("/admin/settings/developer");
  const isUsersSettings = pathname.startsWith("/admin/settings/users");
  const isRolesSettings = pathname.startsWith("/admin/settings/roles");

  if (pathname.startsWith("/attendance/qr")) {
    return NextResponse.next();
  }

  if (pathname === "/staff-login" && isLoggedIn) {
    if (isStaff || role === "STAFF") {
      return NextResponse.redirect(new URL("/staff", nextUrl.origin));
    }
    if (role && isAdminRole(role)) {
      return NextResponse.redirect(new URL("/admin", nextUrl.origin));
    }
  }

  if (pathname === "/admin-login" && isLoggedIn && role && isAdminRole(role)) {
    if (isStaff) {
      return NextResponse.redirect(new URL("/staff", nextUrl.origin));
    }
    return NextResponse.redirect(new URL("/admin", nextUrl.origin));
  }

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

  if (isDeveloperSettings || isUsersSettings) {
    if (!isLoggedIn || !isSuperAdmin(role, email)) {
      return new NextResponse(null, { status: 404 });
    }
  }

  if (isRolesSettings) {
    if (!isLoggedIn || (role !== "ADMIN" && !isSuperAdmin(role, email))) {
      return NextResponse.redirect(new URL("/admin-login", nextUrl.origin));
    }
  }

  if (isStaffRoute) {
    const canAccessStaff =
      isLoggedIn && (isStaff || role === "STAFF" || (role && isAdminRole(role)));
    if (!canAccessStaff) {
      const loginUrl = new URL("/staff-login", nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isAdminRoute) {
    if (isLoggedIn && isStaff) {
      return NextResponse.redirect(new URL("/staff", nextUrl.origin));
    }
    if (!isLoggedIn || !canAccessAdminPath(session, pathname, email)) {
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
    "/staff",
    "/staff/:path*",
    "/staff-login",
    "/admin-login",
    "/attendance/qr",
    "/clock-in",
    "/track/:path*",
    "/quote/:path*",
    "/journal",
    "/journal/:path*",
    "/reset-password",
  ],
};
