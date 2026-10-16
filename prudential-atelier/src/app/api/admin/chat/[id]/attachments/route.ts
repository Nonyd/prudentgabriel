import { NextRequest, NextResponse } from "next/server";
import { ChatAuthor, ChatStatus } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";
import { staffChatName } from "@/lib/chat";
import { CHAT_MESSAGE_MAX } from "@/lib/chat-shared";
import { CHAT_UPLOAD_FOLDER } from "@/lib/chat-files";
import { claimConversation } from "@/lib/chat-claim";
import { storePrivateUpload } from "@/lib/media/private-upload";
import { threadChanged } from "@/lib/chat-bus";

/**
 * BF7: the house sends a file — a fabric photograph, an invoice. The same
 * upload path and allowlist as hers; sending claims the conversation like a reply.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("chat");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const user = gate.session.user;
  const claim = await claimConversation(id, { ...user, id: user.id! }, { ip: getClientIp(req) });
  if (!claim.ok) {
    return NextResponse.json(
      { error: claim.status === 404 ? "Not found" : `${claim.holder?.name ?? "Someone"} is handling this conversation.` },
      { status: claim.status },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const up = await storePrivateUpload(form.get("file"), { folder: CHAT_UPLOAD_FOLDER, errorType: "CHAT_UPLOAD", fallbackName: "file" });
  if (!up.ok) return up.response;

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, displayName: true } });
  const now = new Date();
  const message = await prisma.chatMessage.create({
    data: {
      conversationId: id,
      author: ChatAuthor.STAFF,
      staffUserId: user.id,
      staffName: staffChatName(me ?? user),
      body: String(form.get("caption") ?? "").trim().slice(0, CHAT_MESSAGE_MAX),
      attachments: {
        create: {
          conversationId: id,
          author: ChatAuthor.STAFF,
          staffUserId: user.id,
          storageKey: up.stored.key,
          mime: up.mime,
          bytes: up.bytes,
          originalName: up.originalName,
        },
      },
    },
  });
  await prisma.chatConversation.update({
    where: { id },
    data: { lastMessageAt: now, staffSeenAt: now, status: ChatStatus.OPEN, closedAt: null, awaitingSince: null, unansweredStage: 0, handlerActiveAt: now },
  });
  threadChanged(id, "file");
  return NextResponse.json({ id: message.id }, { status: 201 });
}
