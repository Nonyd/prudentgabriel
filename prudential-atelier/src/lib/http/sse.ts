import type { NextRequest } from "next/server";

/**
 * Slice BF1 — a server-sent event stream: server to client only. Everything the
 * client sends stays an ordinary POST.
 *
 * Nothing between here and the browser may buffer it:
 * - `Cache-Control: no-transform` stops Next's own gzip (`compress: true`) and
 *   Cloudflare from compressing, which is what holds an event back until a
 *   buffer fills. Traefik's pg-gzip already excludes text/event-stream.
 * - `X-Accel-Buffering: no` is the de facto "do not buffer" signal proxies honour.
 * - A comment line every HEARTBEAT_MS keeps the connection inside Cloudflare's
 *   100-second idle limit and lets the client notice a dead link.
 * The Cloudflare dashboard step (a cache-bypass rule for these paths) is in
 * deploy/DEPLOY.md, because Cloudflare is not configured from this repository.
 */

export const SSE_HEARTBEAT_MS = 20_000;
/** Close after this long; the browser reconnects on its own (EventSource retries). */
export const SSE_MAX_LIFETIME_MS = 30 * 60_000;

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-store, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export type SseSend = (event: string, data: unknown) => void;

/**
 * Opens a stream. `start` subscribes and returns its cleanup; it runs once the
 * stream is open and the cleanup runs when the browser goes away (or the
 * lifetime ends). `onHeartbeat` runs with each heartbeat.
 */
export function sseResponse(
  req: NextRequest,
  start: (send: SseSend) => (() => void) | Promise<() => void>,
  opts: { onHeartbeat?: () => void | Promise<void> } = {},
): Response {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let lifetime: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (lifetime) clearTimeout(lifetime);
        try {
          cleanup?.();
        } catch {
          /* ignore */
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const send: SseSend = (event, data) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      req.signal.addEventListener("abort", close);
      // Reconnect after 3s if the line drops; a padding comment flushes any proxy that waits for bytes.
      write(`retry: 3000\n:${" ".repeat(2048)}\n\n`);
      cleanup = await start(send);
      if (closed) {
        cleanup();
        return;
      }
      send("ready", { at: Date.now() });
      heartbeat = setInterval(() => {
        write(`: ping ${Date.now()}\n\n`);
        void Promise.resolve(opts.onHeartbeat?.()).catch(() => {});
      }, SSE_HEARTBEAT_MS);
      lifetime = setTimeout(close, SSE_MAX_LIFETIME_MS);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (lifetime) clearTimeout(lifetime);
      cleanup?.();
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
