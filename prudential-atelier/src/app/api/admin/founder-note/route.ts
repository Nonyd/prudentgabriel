import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SettingGroup, SettingType } from "@prisma/client";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { clearSettingCacheKey } from "@/lib/settings";
import { logActivity } from "@/lib/logger";
import {
  DEFAULT_FOUNDER_NOTE,
  FOUNDER_NOTE_MAX_CHARS,
  FOUNDER_NOTE_SETTING,
  FOUNDER_NOTE_SUBJECT,
  getFounderNoteText,
  renderFounderNote,
} from "@/lib/founder-note";

/** The founder's note: read, preview and save its text. Super Admin only. */
export async function GET() {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;
  const text = await getFounderNoteText();
  return NextResponse.json({
    text,
    isDefault: text === DEFAULT_FOUNDER_NOTE,
    subject: FOUNDER_NOTE_SUBJECT,
    maxChars: FOUNDER_NOTE_MAX_CHARS,
  });
}

const bodySchema = z.object({
  text: z.string().max(FOUNDER_NOTE_MAX_CHARS),
  /** true: return the rendered email for the preview, save nothing. */
  preview: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: `The letter can be up to ${FOUNDER_NOTE_MAX_CHARS} characters.` }, { status: 400 });
  }
  const text = parsed.data.text.replace(/\r\n/g, "\n").trim();

  if (parsed.data.preview) {
    return NextResponse.json({ html: await renderFounderNote("Adaeze", text || DEFAULT_FOUNDER_NOTE) });
  }
  if (text.length < 20) {
    return NextResponse.json({ error: "Please write at least a sentence or two." }, { status: 400 });
  }

  await prisma.siteSetting.upsert({
    where: { key: FOUNDER_NOTE_SETTING },
    create: {
      key: FOUNDER_NOTE_SETTING,
      value: text,
      label: "Founder's note (welcome letter text)",
      group: SettingGroup.CONTENT,
      type: SettingType.TEXTAREA,
      isPublic: false,
      updatedBy: gate.session.user.id!,
    },
    update: { value: text, updatedBy: gate.session.user.id! },
  });
  clearSettingCacheKey(FOUNDER_NOTE_SETTING);

  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role ?? undefined,
    action: "UPDATE",
    module: "settings",
    description: "Updated the founder's note (welcome letter)",
    recordType: "SiteSetting",
    recordId: FOUNDER_NOTE_SETTING,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
