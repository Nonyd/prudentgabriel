import { NextRequest, NextResponse } from "next/server";
import { ChatAuthor, ChatStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { dailyUploadCapOr429 } from "@/lib/upload-limits";
import { isChatOpen } from "@/lib/chat";
import { CHAT_MESSAGE_MAX } from "@/lib/chat-shared";
import { resolveChatVisitor } from "@/lib/chat-visitor";
import { CHAT_UPLOAD_FOLDER } from "@/lib/chat-files";
import { storePrivateUpload } from "@/lib/media/private-upload";
import { threadChanged } from "@/lib/chat-bus";

/**
 * BF7: she sends a file — a receipt, a photograph. It comes from someone who
 * may not be signed in, so it goes through the same upload path as guest
 * receipts (size, type read from the bytes, HEIC → JPEG, private store), with
 * a per-address limit and a daily cap across everyone. Images and PDF only.
 */
export async function POST(req: NextRequest) {
  if (!(await isChatOpen())) return NextResponse.json({ error: "Chat is not open at the moment." }, { status: 403 });
  const limited = await rateLimitOr429(req, "chat-upload", 10, 15 * 60 * 1000);
  if (limited) return limited;
  const { conversation } = await resolveChatVisitor(req);
  if (!conversation) return NextResponse.json({ error: "Start the chat first, then send a file." }, { status: 404 });
  const capped = await dailyUploadCapOr429("chat-upload");
  if (capped) return capped;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const up = await storePrivateUpload(form.get("file"), { folder: CHAT_UPLOAD_FOLDER, errorType: "CHAT_UPLOAD", fallbackName: "file" });
  if (!up.ok) return up.response;

  const caption = String(form.get("caption") ?? "").trim().slice(0, CHAT_MESSAGE_MAX);
  const now = new Date();
  const message = await prisma.chatMessage.create({
    data: {
      conversationId: conversation.id,
      author: ChatAuthor.VISITOR,
      body: caption,
      attachments: {
        create: {
          conversationId: conversation.id,
          author: ChatAuthor.VISITOR,
          storageKey: up.stored.key,
          mime: up.mime,
          bytes: up.bytes,
          originalName: up.originalName,
        },
      },
    },
  });
  await prisma.chatConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: now,
      visitorSeenAt: now,
      status: ChatStatus.OPEN,
      closedAt: null,
      awaitingSince: conversation.awaitingSince ?? now,
    },
  });
  threadChanged(conversation.id, "file");
  return NextResponse.json({ id: message.id }, { status: 201 });
}
