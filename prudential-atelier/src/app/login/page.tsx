import { Suspense } from "react";
import { LoginContent } from "@/app/(auth)/auth/login/LoginContent";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ivory" />}>
      <LoginContent />
    </Suspense>
  );
}
