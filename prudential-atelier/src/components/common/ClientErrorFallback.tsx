"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

export function ClientErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({ message: error.message, stack: error.stack, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16">
      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-gold">Error</p>
      <h1 className="mt-4 font-display text-3xl text-charcoal">Something went wrong</h1>
      <p className="mt-3 max-w-md text-center font-body text-sm text-charcoal-light">
        This was recorded in the error log. You can try again, or go back and continue.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 font-label text-[11px] uppercase tracking-[0.15em] text-choc underline-offset-4 hover:underline"
      >
        Try again
      </button>
    </div>
  );
}
