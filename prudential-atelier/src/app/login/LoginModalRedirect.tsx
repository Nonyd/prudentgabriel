"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthModalStore } from "@/store/authModalStore";

export function LoginModalRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openLogin = useAuthModalStore((s) => s.openLogin);

  useEffect(() => {
    const callbackUrl = searchParams.get("callbackUrl") ?? "/account";
    openLogin(callbackUrl);
    const returnTo =
      typeof window !== "undefined" && document.referrer
        ? (() => {
            try {
              const ref = new URL(document.referrer);
              if (ref.origin === window.location.origin && !isAuthPath(ref.pathname)) {
                return ref.pathname + ref.search;
              }
            } catch {
              /* ignore */
            }
            return "/";
          })()
        : "/";
    router.replace(returnTo);
  }, [openLogin, router, searchParams]);

  return null;
}

function isAuthPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login") ||
    pathname === "/auth/login" ||
    pathname === "/register" ||
    pathname.startsWith("/register") ||
    pathname === "/auth/register"
  );
}
