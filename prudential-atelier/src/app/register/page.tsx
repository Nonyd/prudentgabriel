import { Suspense } from "react";
import { RegisterModalRedirect } from "./RegisterModalRedirect";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterModalRedirect />
    </Suspense>
  );
}
