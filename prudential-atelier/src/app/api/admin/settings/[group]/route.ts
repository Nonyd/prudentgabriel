import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { permissionForSettingsGroup, requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { clearPublicSettingsCache, clearSettingCacheKey, setSetting } from "@/lib/settings";
import { ensurePaymentSettingKeys } from "@/lib/payment-settings-bootstrap";
import { ensureShippingSettingKeys } from "@/lib/shipping-settings-bootstrap";
import { ensureAppearanceLogoSettingKeys } from "@/lib/appearance-settings-bootstrap";
import { revalidateSettings } from "@/lib/revalidate";
import { EMAIL_TEMPLATE_META } from "@/lib/email-templates";
import { SettingType, type SettingGroup } from "@prisma/client";

const GROUPS = new Set<string>([
  "STORE",
  "PAYMENTS",
  "EMAIL",
  "SMS",
  "SHIPPING",
  "APPEARANCE",
  "SOCIAL",
  "NOTIFICATIONS",
  "LOYALTY",
  "SEO",
  "CONTENT",
  "INVOICE",
]);

const PASSWORD_MASK = "••••••••";

const patchSchema = z.object({
  updates: z.array(z.object({ key: z.string().min(1), value: z.string() })),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { group: string } },
) {
  const group = params.group.toUpperCase();
  if (!GROUPS.has(group)) {
    return NextResponse.json({ error: "Invalid group" }, { status: 400 });
  }

  const gate = await requireAdminApi(permissionForSettingsGroup(group));
  if (!gate.ok) return gate.response;

  if (group === "PAYMENTS") {
    await ensurePaymentSettingKeys();
  }

  if (group === "SHIPPING") {
    await ensureShippingSettingKeys();
  }

  if (group === "APPEARANCE") {
    await ensureAppearanceLogoSettingKeys();
  }

  const rows = await prisma.siteSetting.findMany({
    where: { group: group as SettingGroup },
    orderBy: { sortOrder: "asc" },
    select: {
      key: true,
      value: true,
      group: true,
      label: true,
      type: true,
      isPublic: true,
      sortOrder: true,
      updatedAt: true,
      updatedBy: true,
    },
  });

  const items = rows.map((r) => ({
    ...r,
    value: r.type === "PASSWORD" && r.value.length > 0 ? PASSWORD_MASK : r.value,
  }));

  return NextResponse.json({ items });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { group: string } },
) {
  const group = params.group.toUpperCase();
  if (!GROUPS.has(group)) {
    return NextResponse.json({ error: "Invalid group" }, { status: 400 });
  }

  const gate = await requireAdminApi(permissionForSettingsGroup(group));
  if (!gate.ok) return gate.response;

  if (group === "PAYMENTS") {
    await ensurePaymentSettingKeys();
  }

  if (group === "SHIPPING") {
    await ensureShippingSettingKeys();
  }

  if (group === "APPEARANCE") {
    await ensureAppearanceLogoSettingKeys();
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userId = gate.session.user!.id!;
  let updated = 0;
  let paymentKeysTouched = false;

  for (const { key, value } of parsed.data.updates) {
    const row = await prisma.siteSetting.findUnique({
      where: { key },
      select: { group: true, type: true },
    });

    if (!row) {
      if (
        (group as SettingGroup) === "EMAIL" &&
        key.startsWith("email_tpl_") &&
        EMAIL_TEMPLATE_META[key]
      ) {
        const meta = EMAIL_TEMPLATE_META[key];
        await prisma.siteSetting.create({
          data: {
            key,
            value,
            group: "EMAIL",
            label: meta.label,
            type: SettingType.JSON,
            isPublic: false,
            sortOrder: meta.sortOrder,
            updatedBy: userId,
          },
        });
        clearSettingCacheKey(key);
        clearPublicSettingsCache();
        updated += 1;
        continue;
      }
      return NextResponse.json({ error: `Invalid key for group: ${key}` }, { status: 400 });
    }

    if (row.group !== (group as SettingGroup)) {
      return NextResponse.json({ error: `Invalid key for group: ${key}` }, { status: 400 });
    }

    if (row.type === "PASSWORD") {
      const trimmed = value.trim();
      if (trimmed === "" || trimmed === PASSWORD_MASK) {
        continue;
      }
    }

    if (row.group === "PAYMENTS" && row.type === "PASSWORD" && value.trim() !== "" && value !== PASSWORD_MASK) {
      paymentKeysTouched = true;
    }

    await setSetting(key, value, userId);
    updated += 1;
  }

  await revalidateSettings();

  return NextResponse.json({
    success: true,
    updated,
    paymentKeysChanged: paymentKeysTouched,
    note: paymentKeysTouched
      ? "Payment secrets were updated. Restart the app if any services still read from environment variables only."
      : undefined,
  });
}
