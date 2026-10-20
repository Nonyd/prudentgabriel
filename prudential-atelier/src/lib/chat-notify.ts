import { alertEmailTargets, alertRecipientCandidates, eligibleFor } from "@/lib/admin-alerts";
import { createNotification } from "@/lib/notifications";
import { sendStaffNotificationEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";
import { getChatStaffing, type ChatStaffing } from "@/lib/chat";

/**
 * Slice BF9 — who is told about a chat. Prudent Gabriel's SUPER_ADMIN names the
 * people on Settings → Who is told, for email and for the bell separately.
 * Email goes to exactly those named; the bell, until she names anyone, goes to
 * everyone who answers chat. A named person who is deactivated (or is now Staff
 * without Live chat) is skipped.
 *
 * Per conversation, not per message: a new conversation tells everyone; after
 * that only BF6's unanswered clock tells them again.
 */

/** People who may be named: everyone in Users & Roles except Staff, plus Staff who hold Live chat. */
export async function chatRecipientCandidates(): Promise<{ id: string; name: string; email: string; role: string }[]> {
  return (await alertRecipientCandidates())
    .filter((c) => eligibleFor("chat", c))
    .map((c) => ({ id: c.id, name: c.name, email: c.email, role: c.role }));
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
  // Exactly the people and addresses named for Live chat on Settings → Who is told.
  const emailTo = await alertEmailTargets("chat").catch(() => []);
  for (const t of emailTo) {
    await sendStaffNotificationEmail({
      to: t.to,
      subject: params.title,
      htmlInner: html,
      idempotencyKey: `${key}:${t.userId ?? t.to}`,
      relatedType: "ChatConversation",
      relatedId: params.conversationId,
    }).catch(() => {});
  }
  return { bell: bellTo.length ? "named" : "desk", email: emailTo.length ? "named" : "desk", emailed: emailTo.length };
}
