"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

function shouldIgnore(message: string): boolean {
  const m = message.toLowerCase();
  if (!m.trim()) return true;
  if (m.includes("resizeobserver")) return true;
  if (m.includes("script error")) return true;
  if (m.includes("chrome-extension://")) return true;
  if (m.includes("moz-extension://")) return true;
  return false;
}

/** Catches window errors and unhandled promise rejections for the admin Error Log. */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const message = event.message || (event.error instanceof Error ? event.error.message : "") || "window error";
      if (shouldIgnore(message)) return;
      reportClientError({
        message,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? "unhandled rejection");
      if (shouldIgnore(message)) return;
      reportClientError({
        message,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
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
