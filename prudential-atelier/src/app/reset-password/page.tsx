import { Suspense } from "react";
import { ResetPasswordClient } from "@/components/auth/ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-4 py-16">
      <Suspense fallback={null}>
        <ResetPasswordClient />
      </Suspense>
    </div>
  );
}
