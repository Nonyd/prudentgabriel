/** BA5 chat — client-safe constants and helpers (no server imports). */

/** Essential cookie holding the visitor's conversation token (httpOnly). */
export const CHAT_COOKIE = "pg_chat";

export const CHAT_MESSAGE_MAX = 2000;

/** The commission journey: chat acknowledges, then hands over the enquiry form. */
export function isAtelierPath(path: string): boolean {
  return /^\/(atelier|bridal|bespoke|consultation)(\/|$)/.test(path);
}

export type ChatMessageView = {
  id: string;
  author: "VISITOR" | "STAFF" | "SYSTEM";
  staffName: string | null;
  body: string;
  createdAt: string;
};

export const CHAT_CLOSED_MESSAGE = "Chat is not open at the moment. Please use the contact page.";
