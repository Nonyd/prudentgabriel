import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;

  const isLoggedIn = !!session;
  const isAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  const isAccountRoute = nextUrl.pathname.startsWith("/account");
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  if (isAccountRoute && !isLoggedIn) {
    const loginUrl = new URL("/auth/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL("/admin-login", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/account/:path*", "/admin", "/admin/:path*"],
};
