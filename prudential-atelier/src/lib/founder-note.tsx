import { getPublicAppUrl } from "@/lib/app-url";
import { renderBrandedEmail } from "@/lib/email";
import { queueEmail } from "@/lib/email-outbox";
import { getSetting } from "@/lib/settings";
import { logServerError } from "@/lib/logger";
import FounderNoteEmail from "@/emails/FounderNoteEmail";

/**
 * A personal note from Mrs Prudent Gabriel-Okopi, ten minutes after a client's
 * account is created: by signing up, by a first paid order, consultation or
 * commission (the automatic account), or by a first Google sign-in. Staff and
 * admin accounts never get it. Only the letter's text is editable, by a Super
 * Admin (Content → Email templates → Founder's note).
 */

export const FOUNDER_NOTE_SUBJECT = "Mrs Prudent Gabriel-Okopi has a word for you";
export const FOUNDER_NOTE_SETTING = "founder_note_text";
export const FOUNDER_NOTE_DELAY_MS = 10 * 60 * 1000;
export const FOUNDER_NOTE_MAX_CHARS = 4000;

export const DEFAULT_FOUNDER_NOTE = `Thank you for joining us. I wanted to write to you myself, because every woman who finds her way to this house matters to me.

Prudent Gabriel began with a simple belief: that a woman should feel, in what she wears, exactly who she is. Every piece we make is cut for you after you choose it, in our atelier in Lagos, by hands that care about the smallest stitch.

Whether you are here for a dress for a Sunday, a gown for the biggest day of your life, or simply to look around, you are welcome. If there is ever anything you need, reply to this email and my team will take care of you.

I cannot wait to see you in Prudent Gabriel.`;

/** The saved text, or the default. Paragraphs are separated by a blank line. */
export async function getFounderNoteText(): Promise<string> {
  const saved = (await getSetting(FOUNDER_NOTE_SETTING))?.trim();
  return saved || DEFAULT_FOUNDER_NOTE;
}

export function founderNoteParagraphs(text: string, firstName: string): string[] {
  return text
    .replace(/\{\{\s*firstName\s*\}\}/g, firstName)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export async function renderFounderNote(firstName: string, text?: string): Promise<string> {
  const body = text ?? (await getFounderNoteText());
  return renderBrandedEmail(
    <FounderNoteEmail
      firstName={firstName}
      paragraphs={founderNoteParagraphs(body, firstName)}
      shopUrl={`${getPublicAppUrl()}/rtw`}
    />,
    "main",
    // She signs it herself: no "The Prudent Gabriel Team" line underneath.
    null,
  );
}

function firstNameOf(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || "there";
}

/** Queue the note to go out ten minutes from now. Once per account, never throws. */
export async function scheduleFounderNote(user: { id: string; email: string; name?: string | null }): Promise<void> {
  try {
    const html = await renderFounderNote(firstNameOf(user.name));
    await queueEmail({
      to: user.email,
      subject: FOUNDER_NOTE_SUBJECT,
      html,
      template: "founder-note",
      idempotencyKey: `founder-note:${user.id}`,
      relatedType: "User",
      relatedId: user.id,
      sendAt: new Date(Date.now() + FOUNDER_NOTE_DELAY_MS),
    });
  } catch (error) {
    await logServerError({ errorType: "FOUNDER_NOTE", error }).catch(() => {});
  }
}
