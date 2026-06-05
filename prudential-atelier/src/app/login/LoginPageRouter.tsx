"use client";

import { useSearchParams } from "next/navigation";
import { LoginModalRedirect } from "./LoginModalRedirect";
import { PortalLoginClient } from "./PortalLoginClient";

function isClientLoginIntent(callbackUrl: string | null, registered: string | null): boolean {
  if (registered === "1") return true;
  if (!callbackUrl) return false;

  try {
    const path = callbackUrl.startsWith("http")
      ? new URL(callbackUrl).pathname
      : callbackUrl.split("?")[0];
    return path.startsWith("/account");
  } catch {
    return false;
  }
}

export function LoginPageRouter() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const registered = searchParams.get("registered");

  if (isClientLoginIntent(callbackUrl, registered)) {
    return <LoginModalRedirect />;
  }

  return <PortalLoginClient />;
}
