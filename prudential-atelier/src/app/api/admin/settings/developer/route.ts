import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { setSetting } from "@/lib/settings";
import { ensurePaymentSettingKeys } from "@/lib/payment-settings-bootstrap";
import { ensureShippingSettingKeys } from "@/lib/shipping-settings-bootstrap";
import { revalidateSettings } from "@/lib/revalidate";
import {
  DEVELOPER_SETTING_KEYS,
  developerEnvStatus,
  isDeveloperSettingKey,
} from "@/lib/settings-developer";
import type { SettingGroup } from "@prisma/client";

const PASSWORD_MASK = "••••••••";

const patchSchema = z.object({
  updates: z.array(z.object({ key: z.string().min(1), value: z.string() })),
});

export async function GET() {
  const gate = await requireAdminApi("settings.developer");
  if (!gate.ok) return gate.response;

  await Promise.all([ensurePaymentSettingKeys(), ensureShippingSettingKeys()]);

  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Array.from(DEVELOPER_SETTING_KEYS) } },
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
    select: {
      key: true,
      value: true,
      group: true,
      label: true,
      type: true,
      isPublic: true,
      sortOrder: true,
    },
  });

  const items = rows.map((r) => ({
    ...r,
    value: r.type === "PASSWORD" && r.value.length > 0 ? PASSWORD_MASK : r.value,
  }));

  const byGroup: Partial<Record<SettingGroup, typeof items>> = {};
  for (const r of items) {
    const bucket = byGroup[r.group] ?? (byGroup[r.group] = []);
    bucket.push(r);
  }

  return NextResponse.json({
    items,
    groups: byGroup,
    env: developerEnvStatus(),
  });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminApi("settings.developer");
  if (!gate.ok) return gate.response;

  await Promise.all([ensurePaymentSettingKeys(), ensureShippingSettingKeys()]);

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userId = gate.session.user!.id!;
  let updated = 0;
  let paymentKeysTouched = false;

  for (const { key, value } of parsed.data.updates) {
    if (!isDeveloperSettingKey(key)) {
      return NextResponse.json(
        { error: `Not a developer credential: ${key}` },
        { status: 400 },
      );
    }

    const row = await prisma.siteSetting.findUnique({
      where: { key },
      select: { group: true, type: true },
    });
    if (!row) {
      return NextResponse.json({ error: `Unknown key: ${key}` }, { status: 400 });
    }

    if (row.type === "PASSWORD") {
      const trimmed = value.trim();
      if (trimmed === "" || trimmed === PASSWORD_MASK) continue;
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
  });
}
