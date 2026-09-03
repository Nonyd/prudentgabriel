import { NextRequest, NextResponse } from "next/server";
import { streamMediaKey } from "@/lib/media/stream";
import { isValidMediaKey } from "@/lib/media/keys";
import { verifyMediaSignature } from "@/lib/media/signed";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get("k") ?? "";
  const exp = Number(req.nextUrl.searchParams.get("exp") ?? 0);
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  if (!isValidMediaKey(k) || !verifyMediaSignature(k, exp, sig)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return streamMediaKey(k, { allowPrivate: true, cache: "private" });
}
