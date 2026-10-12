import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { logViewAsRequest } from "@/lib/client-view-as";

const bodySchema = z.object({
  method: z.string().min(1).max(10),
  pathname: z.string().startsWith("/").max(500),
  serverAction: z.boolean().optional(),
});

/**
 * POST /api/view-as/log — the middleware reports each page and change made while
 * an admin views as a client (it runs on the edge and cannot write the log itself).
 * The session decides whose line it is; a session that is not viewing as anyone
 * writes nothing.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.viewAs) return new NextResponse(null, { status: 204 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await logViewAsRequest(session, {
    ...parsed.data,
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
  });
  return NextResponse.json({ ok: true });
}
