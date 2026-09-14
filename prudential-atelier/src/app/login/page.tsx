import { Suspense } from "react";
import { LoginPageRouter } from "./LoginPageRouter";
import { tokenRouteMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = tokenRouteMetadata("Sign in");

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageRouter />
    </Suspense>
  );
}
