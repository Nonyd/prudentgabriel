"use client";

import { ClientErrorFallback } from "@/components/common/ClientErrorFallback";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ClientErrorFallback error={error} reset={reset} />;
}
