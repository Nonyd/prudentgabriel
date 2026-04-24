import { Suspense } from "react";
import { RegisterContent } from "./RegisterContent";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ivory" />}>
      <RegisterContent />
    </Suspense>
  );
}
