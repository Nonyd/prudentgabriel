import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { buildCampaignHtml, sendSingleMarketingEmail } from "@/lib/send-email-jobs";
import { EMAIL_TEMPLATE_KEYS } from "@/lib/admin-email-catalog";

const bodySchema = z.object({
  subject: z.string().min(1),
  body: z.string().default(""),
  templateKey: z.string().optional(),
  collectionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const to = gate.session.user?.email;
  if (!to) {
    return NextResponse.json({ error: "Your account has no email" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.templateKey === EMAIL_TEMPLATE_KEYS.COLLECTION_CAMPAIGN && !parsed.data.collectionId) {
    return NextResponse.json({ error: "Select a collection" }, { status: 400 });
  }

  const built = await buildCampaignHtml({
    subject: parsed.data.subject,
    body: parsed.data.body,
    templateKey: parsed.data.templateKey,
    collectionId: parsed.data.collectionId,
  });

  await sendSingleMarketingEmail({
    to,
    subject: `[TEST] ${built.subject}`,
    html: built.html,
    template: built.template,
    defer: false,
  });

  return NextResponse.json({ success: true, to });
}
