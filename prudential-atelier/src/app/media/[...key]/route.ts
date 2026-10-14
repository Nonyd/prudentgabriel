import { NextRequest, NextResponse } from "next/server";
import { streamMediaKey } from "@/lib/media/stream";
import { isValidMediaKey } from "@/lib/media/keys";
import { isPrivateMediaKey } from "@/lib/media/key-parse";
import { gatePrivateMediaKey } from "@/lib/media/admin-media-gate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

async function serve(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }, head: boolean) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  if (isValidMediaKey(key) && isPrivateMediaKey(key)) {
    // Private files (moodboards, receipts) are stored as /media/private/... and shown
    // across the portal by that path. Serve them to a signed-in desk that may see the
    // folder; to anyone else they do not exist. Every answer here depends on who asks,
    // so none may be cached: Cloudflare caches a .jpg 404 with no headers and then
    // serves that 404 to signed-in staff too.
    const gate = await gatePrivateMediaKey(key);
    const res = gate.ok
      ? await streamMediaKey(key, { allowPrivate: true, cache: "private", range: req.headers.get("range"), head })
      : NextResponse.json({ error: "Not found" }, { status: 404 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }
  return streamMediaKey(key, {
    allowPrivate: false,
    cache: "public",
    range: req.headers.get("range"),
    head,
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  return serve(req, ctx, false);
}

export async function HEAD(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  return serve(req, ctx, true);
}
