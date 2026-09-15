import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-static";

const ASSOCIATION_PATH = join(
  process.cwd(),
  "public",
  ".well-known",
  "apple-developer-merchantid-domain-association",
);

const HEADERS = {
  "Content-Type": "text/plain",
  "Cache-Control": "public, max-age=86400",
};

async function associationBody(): Promise<string> {
  return readFile(ASSOCIATION_PATH, "utf8");
}

export async function GET() {
  return new NextResponse(await associationBody(), { headers: HEADERS });
}

export async function HEAD() {
  const body = await associationBody();
  return new NextResponse(null, {
    headers: {
      ...HEADERS,
      "Content-Length": String(Buffer.byteLength(body, "utf8")),
    },
  });
}
