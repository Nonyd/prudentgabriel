import { Suspense } from "react";
import { LoginPageRouter } from "./LoginPageRouter";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageRouter />
    </Suspense>
  );
}
