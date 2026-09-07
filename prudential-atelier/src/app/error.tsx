"use client";

import { ClientErrorFallback } from "@/components/common/ClientErrorFallback";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ClientErrorFallback error={error} reset={reset} />;
}
