import { Suspense } from "react";
import { LoginContent } from "./LoginContent";

export default function AuthLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
