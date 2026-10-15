import { ActivityAction, ChatAuthor, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getChatStaffing, staffChatName } from "@/lib/chat";
import { threadChanged } from "@/lib/chat-bus";

/**
 * Slice BF5 — one conversation, one handler. Claiming controls who replies,
 * never who reads: every admin who passes the chat gate sees every thread.
 *
 * - Starting to reply claims it (the inbox shows who holds each one).
 * - A second admin is refused (409) while the holder is active; she can take
 *   it over deliberately, which is logged and shown in the thread.
 * - Releasing it, or going idle past the setting, returns it to the pool.
 */

export type ChatHolder = { id: string; name: string };

type Holding = { handlerId: string | null; handlerName: string | null; handlerActiveAt: Date | null };

/** The live holder, or null when nobody holds it or the holder went idle. */
export function activeHolder(c: Holding, idleMin: number, now = new Date()): ChatHolder | null {
  if (!c.handlerId) return null;
  if (!c.handlerActiveAt || now.getTime() - c.handlerActiveAt.getTime() > idleMin * 60_000) return null;
  return { id: c.handlerId, name: c.handlerName ?? "someone" };
}

export type ClaimResult =
  | { ok: true; joined: boolean; tookOverFrom: ChatHolder | null }
  | { ok: false; status: 404 | 409; holder?: ChatHolder };

type Actor = { id: string; name?: string | null; displayName?: string | null; email?: string | null; role?: string | null };

export async function claimConversation(
  conversationId: string,
  actor: Actor,
  opts: { takeover?: boolean; ip?: string | null } = {},
): Promise<ClaimResult> {
  const { claimIdleMin } = await getChatStaffing();
  const now = new Date();
  const idleCutoff = new Date(now.getTime() - claimIdleMin * 60_000);
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { name: true, displayName: true } });
  const name = staffChatName(user ?? actor);

  const before = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { handlerId: true, handlerName: true, handlerActiveAt: true },
  });
  if (!before) return { ok: false, status: 404 };
  const holder = activeHolder(before, claimIdleMin, now);
  if (holder && holder.id !== actor.id && !opts.takeover) return { ok: false, status: 409, holder };

  // Atomic: only if still free, already ours, idle — or a deliberate takeover of exactly that holder.
  const where: Prisma.ChatConversationWhereInput = opts.takeover && holder && holder.id !== actor.id
    ? { id: conversationId, handlerId: holder.id }
    : {
        id: conversationId,
        OR: [{ handlerId: null }, { handlerId: actor.id }, { handlerActiveAt: null }, { handlerActiveAt: { lt: idleCutoff } }],
      };
  const { count } = await prisma.chatConversation.updateMany({
    where,
    data: {
      handlerId: actor.id,
      handlerName: name,
      handlerActiveAt: now,
      ...(holder?.id === actor.id ? {} : { claimedAt: now }),
    },
  });
  if (count === 0) {
    const after = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { handlerId: true, handlerName: true, handlerActiveAt: true },
    });
    const h = after ? activeHolder(after, claimIdleMin, now) : null;
    return { ok: false, status: after ? 409 : 404, holder: h ?? undefined };
  }

  const tookOverFrom = holder && holder.id !== actor.id ? holder : null;
  // "Jubilee has joined" — once per arrival, not every time she touches the thread.
  const lastJoin = await prisma.chatMessage.findFirst({
    where: { conversationId, author: ChatAuthor.SYSTEM, internal: false, body: { endsWith: " has joined." } },
    orderBy: { createdAt: "desc" },
    select: { staffUserId: true },
  });
  const joined = lastJoin?.staffUserId !== actor.id;
  if (joined) {
    await prisma.chatMessage.create({
      data: { conversationId, author: ChatAuthor.SYSTEM, staffUserId: actor.id, staffName: name, body: `${name} has joined.` },
    });
  }
  if (tookOverFrom) {
    await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          conversationId,
          author: ChatAuthor.SYSTEM,
          internal: true,
          staffUserId: actor.id,
          staffName: name,
          body: `${name} took this conversation over from ${tookOverFrom.name}.`,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: actor.id,
          userEmail: actor.email ?? null,
          userRole: actor.role ?? "",
          action: ActivityAction.UPDATE,
          module: "chat",
          description: `Took over a chat from ${tookOverFrom.name}`,
          recordId: conversationId,
          recordType: "ChatConversation",
          ipAddress: opts.ip ?? null,
          snapshot: { kind: "ChatTakeover", from: tookOverFrom, to: { id: actor.id, name } } as Prisma.InputJsonValue,
        },
      }),
    ]);
  }
  threadChanged(conversationId, "claim");
  return { ok: true, joined, tookOverFrom };
}

/** The holder is still here (typing, replying, the thread open). */
export async function touchClaim(conversationId: string, userId: string): Promise<void> {
  await prisma.chatConversation.updateMany({
    where: { id: conversationId, handlerId: userId },
    data: { handlerActiveAt: new Date() },
  });
}

/** Back to the pool. Only the holder can release. */
export async function releaseConversation(conversationId: string, userId: string): Promise<boolean> {
  const { count } = await prisma.chatConversation.updateMany({
    where: { id: conversationId, handlerId: userId },
    data: { handlerId: null, handlerName: null, handlerActiveAt: null, claimedAt: null },
  });
  if (count) threadChanged(conversationId, "claim");
  return count > 0;
}
