import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const message = typeof rec.message === "string" && rec.message.trim() ? rec.message.trim().slice(0, 2000) : "";
  if (!message) return NextResponse.json({ ok: true });

  const stack = typeof rec.stack === "string" ? rec.stack.slice(0, 8000) : undefined;
  const url = typeof rec.url === "string" ? rec.url.slice(0, 2000) : undefined;
  const digest = typeof rec.digest === "string" ? rec.digest.slice(0, 200) : undefined;

  await logError({
    severity: "WARNING",
    errorType: "CLIENT_RENDER",
    message: digest ? `${message} [${digest}]` : message,
    stack,
    url,
  });

  return NextResponse.json({ ok: true });
}
