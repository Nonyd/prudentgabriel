import { prisma } from "@/lib/prisma";
import { isGeneralAdminRole } from "@/lib/admin-auth";
import { createNotification } from "@/lib/notifications";
import { sendAdminNotificationEmail, sendStaffNotificationEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";
import { getChatStaffing, type ChatStaffing } from "@/lib/chat";

/**
 * Slice BF9 — who is told about a chat. Prudent Gabriel's SUPER_ADMIN names the
 * people, for email and for the bell separately. Until she does, BA5's routing
 * stands (the contact desk and the admin alert address), so a chat never
 * arrives with nobody told. A named person who can no longer open chat
 * (deactivated, or no longer an admin) is skipped; if that leaves nobody, the
 * BA5 routing is used for that message rather than telling no one.
 *
 * Per conversation, not per message: a new conversation tells everyone; after
 * that only BF6's unanswered clock tells them again.
 */

/** People who may be named: active users who pass the chat gate (the same check the inbox uses). */
export async function chatRecipientCandidates(): Promise<{ id: string; name: string; email: string; role: string }[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return users
    .filter((u) => isGeneralAdminRole(u.role))
    .map((u) => ({ id: u.id, name: u.name?.trim() || u.email, email: u.email, role: u.role }));
}

async function usable(ids: string[] | null) {
  if (!ids?.length) return [];
  const candidates = await chatRecipientCandidates();
  return candidates.filter((c) => ids.includes(c.id));
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export async function notifyChat(params: {
  conversationId: string;
  /** "new" a conversation started; "unanswered" BF6's first period passed. */
  reason: "new" | "unanswered";
  title: string;
  message: string;
  staffing?: ChatStaffing;
}): Promise<{ bell: "named" | "desk"; email: "named" | "desk"; emailed: number }> {
  const s = params.staffing ?? (await getChatStaffing());
  const link = `/admin/chat?open=${params.conversationId}`;
  const url = `${getPublicAppUrl()}${link}`;
  const key = `chat-${params.reason}:${params.conversationId}:${Date.now()}`;

  const bellTo = await usable(s.notifyBellUserIds);
  await createNotification({
    type: "CHAT",
    title: params.title,
    message: params.message,
    link,
    entityId: params.conversationId,
    ...(bellTo.length ? { targetUserIds: bellTo.map((u) => u.id) } : {}),
  }).catch(() => {});

  const html = `<p>${esc(params.message)}</p><p><a href="${url}">Open the chat</a></p>`;
  const emailTo = await usable(s.notifyEmailUserIds);
  if (emailTo.length) {
    for (const u of emailTo) {
      await sendStaffNotificationEmail({
        to: u.email,
        subject: params.title,
        htmlInner: html,
        idempotencyKey: `${key}:${u.id}`,
        relatedType: "ChatConversation",
        relatedId: params.conversationId,
      }).catch(() => {});
    }
  } else {
    await sendAdminNotificationEmail(params.title, html, key).catch(() => {});
  }
  return { bell: bellTo.length ? "named" : "desk", email: emailTo.length ? "named" : "desk", emailed: emailTo.length };
}
