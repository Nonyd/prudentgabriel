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
    // folder, never cached publicly; to anyone else they do not exist.
    const gate = await gatePrivateMediaKey(key);
    if (!gate.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return streamMediaKey(key, { allowPrivate: true, cache: "private", range: req.headers.get("range"), head });
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
