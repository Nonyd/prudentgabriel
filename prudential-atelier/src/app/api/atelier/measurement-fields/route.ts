import { NextRequest, NextResponse } from "next/server";
import { SettingGroup, SettingType } from "@prisma/client";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { requireStaffPortal } from "@/lib/api-auth";
import {
  ATELIER_MEASUREMENT_FIELDS_KEY,
  atelierFieldKey,
  cleanAtelierFields,
  readAtelierMeasurementFields,
  type AtelierMeasurementField,
} from "@/lib/atelier/measurement-fields";
import { logActivity } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { clearSettingCacheKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** The extra atelier measurement fields: read by every measurement form (admin and staff portal). */
export async function GET() {
  const gate = await requireStaffPortal();
  if (!gate.ok) return gate.response;
  return NextResponse.json({ fields: await readAtelierMeasurementFields() });
}

const putSchema = z.object({
  fields: z
    .array(
      z.object({
        /** Absent for a new field: a key is made from its label and never changes. */
        key: z.string().max(60).optional(),
        label: z.string().trim().min(1, "Every field needs a name").max(60),
        help: z.string().trim().max(200).optional(),
        retired: z.boolean().optional(),
      }),
    )
    .max(60),
});

/**
 * Atelier managers and admins (Atelier pipeline permission). Saves the whole
 * list in order. A field that was there is never dropped: leaving it out
 * retires it, so values already taken keep their name.
 */
export async function PUT(req: NextRequest) {
  const gate = await requireAdminApi("bespoke");
  if (!gate.ok) return gate.response;

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const before = await readAtelierMeasurementFields();
  const known = new Map(before.map((f) => [f.key, f]));
  const keys = new Set(before.map((f) => f.key));
  const next: AtelierMeasurementField[] = [];
  for (const f of parsed.data.fields) {
    const key = f.key && known.has(f.key) ? f.key : atelierFieldKey(f.label, keys);
    keys.add(key);
    if (next.some((n) => n.key === key)) continue;
    next.push({ key, label: f.label, ...(f.help ? { help: f.help } : {}), ...(f.retired ? { retired: true } : {}) });
  }
  for (const old of before) {
    if (!next.some((n) => n.key === old.key)) next.push({ ...old, retired: true });
  }

  const labels = next.filter((f) => !f.retired).map((f) => f.label.toLowerCase());
  if (new Set(labels).size !== labels.length) {
    return NextResponse.json({ error: "Two fields have the same name." }, { status: 400 });
  }

  const clean = cleanAtelierFields(next);
  const by = gate.session.user.email ?? gate.session.user.id ?? "admin";
  await prisma.siteSetting.upsert({
    where: { key: ATELIER_MEASUREMENT_FIELDS_KEY },
    create: {
      key: ATELIER_MEASUREMENT_FIELDS_KEY,
      value: JSON.stringify(clean),
      label: "Atelier: extra measurement fields",
      type: SettingType.TEXT,
      group: SettingGroup.STORE,
      isPublic: false,
      sortOrder: 80,
      updatedBy: by,
    },
    update: { value: JSON.stringify(clean), updatedBy: by },
  });
  clearSettingCacheKey(ATELIER_MEASUREMENT_FIELDS_KEY);

  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role ?? undefined,
    action: "UPDATE",
    module: "bespoke",
    description: `Atelier measurement fields: ${clean.filter((f) => !f.retired).map((f) => f.label).join(", ") || "none"}`,
  }).catch(() => undefined);

  return NextResponse.json({ fields: clean });
}
