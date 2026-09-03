import { NextRequest } from "next/server";
import { streamMediaKey } from "@/lib/media/stream";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  return streamMediaKey(key, { allowPrivate: false, cache: "public" });
}
