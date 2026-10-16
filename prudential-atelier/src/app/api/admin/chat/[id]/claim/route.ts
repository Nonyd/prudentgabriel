import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/rate-limit";
import { claimConversation, releaseConversation } from "@/lib/chat-claim";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ takeover: z.boolean().default(false) });

/**
 * BF5: claim a conversation to reply to it. While another admin is actively
 * handling it, a claim is refused (409, with her name); `takeover: true` takes
 * it over deliberately — logged, and shown in the thread. Calling it again as
 * the holder just says "still here".
 */
export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi("chat");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const parsed = bodySchema.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const r = await claimConversation(id, { ...gate.session.user, id: gate.session.user.id! }, { takeover: parsed.data.takeover, ip: getClientIp(req) });
  if (!r.ok) {
    if (r.status === 404) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: `${r.holder?.name ?? "Someone"} is handling this conversation.`, holder: r.holder }, { status: 409 });
  }
  return NextResponse.json({ ok: true, joined: r.joined, tookOverFrom: r.tookOverFrom });
}

/** Release it back to the pool. Only the holder can. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi("chat");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const released = await releaseConversation(id, gate.session.user.id!);
  return NextResponse.json({ ok: released }, { status: released ? 200 : 409 });
}
