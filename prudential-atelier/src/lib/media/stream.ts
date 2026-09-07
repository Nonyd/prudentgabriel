import { open, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getMediaStore } from "@/lib/media";
import { isPrivateMediaKey, isValidMediaKey, mimeForExt } from "@/lib/media/keys";
import { extname } from "node:path";

export type MediaByteRange = { start: number; end: number };

/**
 * Safari (iPhone) will not play MP4 unless the server honours `Range` with 206.
 * Android Chrome often downloads the whole file and still plays.
 *
 * Do not return a Web ReadableStream here. Next.js pipes that as a stalled
 * chunked body — a 5MB hero clip timed out on iPhone after ~3.5MB, so the
 * <video> never decoded a frame.
 */
export function parseMediaByteRange(
  header: string | null | undefined,
  size: number,
): MediaByteRange | "unsatisfiable" | null {
  if (!header || size <= 0) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bytes=")) return null;
  const spec = trimmed.slice(6).split(",")[0]?.trim() ?? "";
  const dash = spec.indexOf("-");
  if (dash < 0) return null;
  const startRaw = spec.slice(0, dash);
  const endRaw = spec.slice(dash + 1);

  if (startRaw === "" && endRaw === "") return null;

  if (startRaw === "") {
    const suffix = Number(endRaw);
    if (!Number.isInteger(suffix) || suffix <= 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(startRaw);
  if (!Number.isInteger(start) || start < 0) return "unsatisfiable";
  if (start >= size) return "unsatisfiable";

  const end = endRaw === "" ? size - 1 : Number(endRaw);
  if (!Number.isInteger(end) || end < start) return "unsatisfiable";
  return { start, end: Math.min(end, size - 1) };
}

function cacheControl(cache: "public" | "private" | "none", mime?: string): string {
  if (cache === "private") return "private, no-store";
  if (cache === "none") return "no-store";
  if (mime?.startsWith("video/") || mime?.startsWith("audio/")) {
    // no-transform stops proxies gziping Range bodies. Short max-age so iPhones
    // drop a poisoned immutable 206 they cached before Traefik excluded MP4.
    return "public, max-age=3600, no-transform";
  }
  return "public, max-age=31536000, immutable";
}

async function readByteRange(abs: string, start: number, length: number): Promise<Buffer> {
  if (length <= 0) return Buffer.alloc(0);
  const fh = await open(abs, "r");
  try {
    const buf = Buffer.alloc(length);
    let filled = 0;
    while (filled < length) {
      const { bytesRead } = await fh.read(buf, filled, length - filled, start + filled);
      if (bytesRead === 0) break;
      filled += bytesRead;
    }
    return filled === length ? buf : buf.subarray(0, filled);
  } finally {
    await fh.close();
  }
}

export async function streamMediaKey(
  key: string,
  opts: {
    allowPrivate: boolean;
    cache: "public" | "private" | "none";
    range?: string | null;
    head?: boolean;
  },
): Promise<NextResponse> {
  if (!isValidMediaKey(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isPrivateMediaKey(key) && !opts.allowPrivate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const abs = getMediaStore().absolutePath(key);
  if (!abs) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let size: number;
  try {
    const st = await stat(abs);
    if (!st.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    size = st.size;
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mime = mimeForExt(extname(key));
  const headers = new Headers();
  headers.set("Content-Type", mime);
  headers.set("Accept-Ranges", "bytes");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", cacheControl(opts.cache, mime));
  headers.set("Content-Disposition", "inline");

  const parsed = parseMediaByteRange(opts.range, size);
  if (parsed === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${size}`);
    headers.set("Content-Length", "0");
    return new NextResponse(null, { status: 416, headers });
  }

  const start = parsed?.start ?? 0;
  const end = parsed?.end ?? Math.max(0, size - 1);
  const length = size === 0 ? 0 : end - start + 1;
  const status = parsed ? 206 : 200;

  if (parsed) {
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  headers.set("Content-Length", String(length));

  if (opts.head || size === 0) {
    return new NextResponse(null, { status, headers });
  }

  const body = await readByteRange(abs, start, length);
  headers.set("Content-Length", String(body.length));
  return new NextResponse(new Uint8Array(body), { status, headers });
}
