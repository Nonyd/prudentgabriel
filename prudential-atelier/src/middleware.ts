import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/** JWT session fields set in src/lib/auth.ts — no database access on Edge. */
type EdgeAuthToken = {
  role?: string;
  isStaff?: boolean;
  mustResetPassword?: boolean;
  email?: string | null;
};

const publicPaths = [
  "/admin-login",
  "/staff-login",
  "/login",
  "/register",
  "/reset-password",
  "/track",
  "/quote",
  "/attendance/qr",
  "/payment/success",
  "/payment/failed",
  "/payment/pending",
  "/api/auth",
  "/api/webhooks",
  "/api/payments/public-config",
  "/_next",
  "/favicon.ico",
  "/journal",
];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname.startsWith(path));
}

function isAdminRole(role: string | undefined): boolean {
  if (!role) return false;
  return (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "STAFF_ADMIN" ||
    role.endsWith("_MANAGER")
  );
}

function isSuperAdmin(role: string | undefined, email?: string | null): boolean {
  if (role === "SUPER_ADMIN") return true;
  const superEmail = process.env.SUPER_ADMIN_EMAIL;
  return Boolean(email && superEmail && email === superEmail);
}

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname;

  const token = (await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  })) as EdgeAuthToken | null;

  const isLoggedIn = Boolean(token);
  const role = token?.role;
  const email = token?.email ?? null;
  const isStaff = Boolean(token?.isStaff);

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
  const isAdminRoute =
    pathname.startsWith("/admin") && !pathname.startsWith("/admin-login");
  const isStaffRoute = pathname.startsWith("/staff") && !pathname.startsWith("/staff-login");
  const isDeveloperSettings = pathname.startsWith("/admin/settings/developer");
  const isUsersSettings = pathname.startsWith("/admin/settings/users");
  const isRolesSettings = pathname.startsWith("/admin/settings/roles");

  if (pathname === "/staff-login" && isLoggedIn) {
    if (isStaff || role === "STAFF") {
      return NextResponse.redirect(new URL("/staff", nextUrl.origin));
    }
    if (role && isAdminRole(role)) {
      return NextResponse.redirect(new URL("/admin", nextUrl.origin));
    }
  }

  if ((isAccountRoute || pathname === "/reset-password") && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    isLoggedIn &&
    token?.mustResetPassword &&
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
    if (isLoggedIn && isStaff && role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/staff", nextUrl.origin));
    }
    if (!isLoggedIn || !isAdminRole(role)) {
      return NextResponse.redirect(new URL("/admin-login", nextUrl.origin));
    }
  }

  return NextResponse.next();
}

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
