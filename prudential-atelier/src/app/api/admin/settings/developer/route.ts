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
  SETTING_REDACTED,
  developerEnvStatus,
  isDeveloperSettingKey,
} from "@/lib/settings-developer";
import {
  MOVABLE_CREDENTIALS,
  adoptEnvCredentialsIntoDatabase,
  credentialDisplayValue,
  describeCredentialSource,
  ENV_SOURCE_LABEL,
  firstEnvValue,
  getDashboardSecret,
} from "@/lib/credential-catalog";
import type { SettingGroup } from "@prisma/client";

const patchSchema = z.object({
  updates: z.array(z.object({ key: z.string().min(1), value: z.string() })).optional(),
  adoptFromEnv: z.literal(true).optional(),
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

  const envBySetting = new Map<string, string | null>();
  for (const entry of MOVABLE_CREDENTIALS) {
    envBySetting.set(entry.settingKey, firstEnvValue(entry.envKeys));
  }

  const items = await Promise.all(
    rows.map(async (r) => {
      const envVal = envBySetting.get(r.key) ?? null;
      const dbVal = r.type === "PASSWORD" || envBySetting.has(r.key) ? await getDashboardSecret(r.key) : r.value;
      const source = describeCredentialSource(dbVal, envVal);
      const display =
        r.type === "PASSWORD" || source === "environment"
          ? credentialDisplayValue(source, dbVal, SETTING_REDACTED)
          : r.value;
      return {
        ...r,
        value: display,
        source,
        inEnvironment: Boolean(envVal),
      };
    }),
  );

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

  if (parsed.data.adoptFromEnv) {
    const { adopted } = await adoptEnvCredentialsIntoDatabase(userId);
    await revalidateSettings();
    return NextResponse.json({ success: true, adopted });
  }

  const updates = parsed.data.updates ?? [];
  if (updates.length === 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  let updated = 0;
  let paymentKeysTouched = false;

  for (const { key, value } of updates) {
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

    const trimmed = value.trim();
    if (trimmed === SETTING_REDACTED || trimmed === ENV_SOURCE_LABEL) continue;
    if (row.type === "PASSWORD" && trimmed === "") continue;

    if (row.group === "PAYMENTS" && row.type === "PASSWORD") {
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
