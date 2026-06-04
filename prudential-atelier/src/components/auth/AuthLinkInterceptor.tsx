"use client";

import { useEffect } from "react";
import { useAuthModalStore } from "@/store/authModalStore";

const LOGIN_PATHS = ["/login", "/auth/login"];
const REGISTER_PATHS = ["/register", "/auth/register"];

function isAuthPath(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}?`));
}

export function AuthLinkInterceptor() {
  const openLogin = useAuthModalStore((s) => s.openLogin);
  const openRegister = useAuthModalStore((s) => s.openRegister);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const pathname = url.pathname;

      if (isAuthPath(pathname, LOGIN_PATHS)) {
        e.preventDefault();
        const callbackUrl = url.searchParams.get("callbackUrl") ?? "/account";
        openLogin(callbackUrl);
        return;
      }

      if (isAuthPath(pathname, REGISTER_PATHS)) {
        e.preventDefault();
        const callbackUrl = url.searchParams.get("callbackUrl") ?? "/account";
        openRegister(callbackUrl);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [openLogin, openRegister]);

  return null;
}
