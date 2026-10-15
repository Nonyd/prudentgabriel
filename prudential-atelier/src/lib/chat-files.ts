import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMediaStore } from "@/lib/media";
import { streamMediaKey } from "@/lib/media/stream";
import { logServerError } from "@/lib/logger";

/**
 * Slice BF7 — chat attachments. They arrive from strangers, so:
 * - stored private in their own folder, reached only through a chat route tied
 *   to the conversation (her cookie, or the chat desk), never a /media path —
 *   gatePrivateMediaKey refuses this folder outright;
 * - served so nothing can run: the stored type, nosniff, a sandboxing CSP, and
 *   only images inline. A PDF downloads instead of opening in the site's origin.
 * And when a conversation is deleted (erase, retention, account deletion) its
 * files are deleted from disk with it.
 */

export const CHAT_UPLOAD_FOLDER = "prudential-atelier/chat";

export function isChatMediaKey(key: string): boolean {
  return key.startsWith(`private/${CHAT_UPLOAD_FOLDER}/`);
}

export async function serveChatAttachment(att: { storageKey: string; mime: string; originalName: string }): Promise<NextResponse> {
  const res = await streamMediaKey(att.storageKey, { allowPrivate: true, cache: "private" });
  if (res.status >= 400) return res;
  const image = att.mime.startsWith("image/");
  const safeName = att.originalName.replace(/["\\\r\n]/g, "_");
  res.headers.set("Content-Type", att.mime);
  res.headers.set("Content-Disposition", `${image ? "inline" : "attachment"}; filename="${safeName}"`);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

/** Storage keys of every file in these conversations — read before they are deleted. */
export async function chatFileKeys(conversationIds: string[]): Promise<string[]> {
  if (conversationIds.length === 0) return [];
  const rows = await prisma.chatAttachment.findMany({
    where: { conversationId: { in: conversationIds } },
    select: { storageKey: true },
  });
  return Array.from(new Set(rows.map((r) => r.storageKey)));
}

/**
 * Delete files from disk once no attachment row points at them (keys are
 * content-addressed, so two conversations can share one file). Call after the
 * rows are gone. Returns the keys actually removed.
 */
export async function deleteOrphanedChatFiles(keys: string[]): Promise<string[]> {
  const removed: string[] = [];
  for (const key of new Set(keys)) {
    if (!isChatMediaKey(key)) continue;
    const still = await prisma.chatAttachment.count({ where: { storageKey: key } });
    if (still > 0) continue;
    try {
      await getMediaStore().delete(key);
      removed.push(key);
    } catch (error) {
      await logServerError({ errorType: "CHAT_FILE_DELETE", error });
    }
  }
  return removed;
}
