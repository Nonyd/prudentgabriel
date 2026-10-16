"use client";

import { useEffect } from "react";
import { isOutsideNoise, isStaleChunkError, reloadForStaleChunk, reportClientError } from "@/lib/report-client-error";

function handle(message: string, stack: string | undefined): void {
  if (isStaleChunkError(message) && reloadForStaleChunk()) return;
  if (isOutsideNoise({ message, stack })) return;
  reportClientError({ message, stack });
}

/** Catches window errors and unhandled promise rejections for the admin Error Log. */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const message = event.message || (event.error instanceof Error ? event.error.message : "") || "window error";
      handle(message, event.error instanceof Error ? event.error.stack : event.filename || undefined);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? "unhandled rejection");
      handle(message, reason instanceof Error ? reason.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
