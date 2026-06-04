import { Suspense } from "react";
import { LoginModalRedirect } from "./LoginModalRedirect";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginModalRedirect />
    </Suspense>
  );
}
