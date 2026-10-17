import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  CORRECTION_SUBJECT,
  DEFAULT_CORRECTION_NOTE,
  listCorrectionRecipients,
  renderCorrectionEmail,
  sendCorrections,
} from "@/lib/loyalty-correction";
import { logActivity } from "@/lib/logger";

/** GET: who gets the correction, plus a rendered preview for the first client still to receive it. */
export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("settings");
  if (!gate.ok) return gate.response;

  const note = req.nextUrl.searchParams.get("note");
  const recipients = await listCorrectionRecipients();
  const sample = recipients.find((r) => !r.sentAt) ?? recipients[0] ?? null;
  const previewHtml = sample ? await renderCorrectionEmail(sample, note ?? DEFAULT_CORRECTION_NOTE) : null;

  return NextResponse.json({
    subject: CORRECTION_SUBJECT,
    defaultNote: DEFAULT_CORRECTION_NOTE,
    recipients,
    previewFor: sample?.email ?? null,
    previewHtml,
  });
}

const postSchema = z.object({ note: z.string().max(1000).nullable(), confirm: z.literal(true) });

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("settings");
  if (!gate.ok) return gate.response;

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confirm the send first" }, { status: 400 });

  const result = await sendCorrections({ note: parsed.data.note, sentById: gate.session.user!.id! });
  void logActivity({
    userId: gate.session.user!.id!,
    userEmail: gate.session.user?.email ?? undefined,
    action: "EMAIL_SENT",
    module: "loyalty",
    description: `Sent ${result.sent} Prudent Points tier correction email(s)`,
    recordType: "LoyaltyCorrectionNotice",
  }).catch(() => {});
  return NextResponse.json({ ok: true, ...result, recipients: await listCorrectionRecipients() });
}
