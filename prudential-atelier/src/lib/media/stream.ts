import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getMediaStore } from "@/lib/media";
import { isPrivateMediaKey, isValidMediaKey, mimeForExt } from "@/lib/media/keys";
import { extname } from "node:path";

export async function streamMediaKey(
  key: string,
  opts: { allowPrivate: boolean; cache: "public" | "private" | "none" },
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
  const web = Readable.toWeb(createReadStream(abs)) as ReadableStream<Uint8Array>;
  const headers = new Headers();
  headers.set("Content-Type", mime);
  headers.set("Content-Length", String(size));
  headers.set("X-Content-Type-Options", "nosniff");
  if (opts.cache === "public") {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (opts.cache === "private") {
    headers.set("Cache-Control", "private, no-store");
  } else {
    headers.set("Cache-Control", "no-store");
  }
  return new NextResponse(web, { status: 200, headers });
}
