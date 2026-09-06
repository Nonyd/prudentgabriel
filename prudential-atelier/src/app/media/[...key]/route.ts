import { NextRequest } from "next/server";
import { streamMediaKey } from "@/lib/media/stream";

export const dynamic = "force-dynamic";

async function serve(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }, head: boolean) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
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
