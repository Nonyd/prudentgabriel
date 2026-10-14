import { NextRequest, NextResponse } from "next/server";
import { isValidMediaKey } from "@/lib/media/keys";
import { gatePrivateMediaKey } from "@/lib/media/admin-media-gate";
import { streamMediaKey } from "@/lib/media/stream";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  if (!isValidMediaKey(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const gate = await gatePrivateMediaKey(key);
  // Per-person answers: never let a proxy keep one (see src/app/media/[...key]/route.ts).
  const res = gate.ok
    ? await streamMediaKey(key, { allowPrivate: true, cache: "private", range: req.headers.get("range") })
    : gate.response;
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
