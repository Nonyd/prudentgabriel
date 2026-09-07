/** Browser → POST /api/logs/client. Failures are swallowed so reporting cannot loop. */
export function reportClientError(error: {
  message?: string;
  stack?: string;
  digest?: string;
}): void {
  if (typeof window === "undefined") return;
  const message = (error.message ?? "Client error").slice(0, 2000);
  const body = JSON.stringify({
    message,
    stack: error.stack?.slice(0, 8000),
    digest: error.digest?.slice(0, 200),
    url: window.location.href.slice(0, 2000),
  });
  void fetch("/api/logs/client", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
