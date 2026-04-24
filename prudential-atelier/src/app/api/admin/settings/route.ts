import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import type { SettingGroup } from "@prisma/client";

const PASSWORD_MASK = "••••••••";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const rows = await prisma.siteSetting.findMany({
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
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

  const settings: Partial<
    Record<
      SettingGroup,
      Array<{
        key: string;
        value: string;
        group: SettingGroup;
        label: string;
        type: (typeof rows)[0]["type"];
        isPublic: boolean;
        sortOrder: number;
        updatedAt: Date;
        updatedBy: string | null;
      }>
    >
  > = {};

  for (const r of rows) {
    const displayValue =
      r.type === "PASSWORD" && r.value.length > 0 ? PASSWORD_MASK : r.value;
    const bucket = settings[r.group] ?? (settings[r.group] = []);
    bucket.push({ ...r, value: displayValue });
  }

  return NextResponse.json({ settings });
}
