import { SettingGroup, SettingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LEGAL_UPDATED,
  LEGAL_COPY_REVISION,
  LEGAL_SEED_ENTRIES,
  legalMdToHtml,
} from "@/lib/legal-copy";

const REVISION_KEY = "legal_copy_revision";

function pageRevisionKey(page: string): string {
  return `legal_page_revision_${page}`;
}

/** Writes legal drafts per page when that page's revision in code is newer. */
export async function ensureLegalCopy(): Promise<void> {
  if (process.env.SKIP_DB_BUILD === "1") return;

  const published = await prisma.siteSetting.findUnique({
    where: { key: REVISION_KEY },
    select: { value: true },
  });
  const lastFullPublish = published?.value ?? "";

  for (const entry of LEGAL_SEED_ENTRIES) {
    const revKey = pageRevisionKey(entry.page);
    const current = await prisma.siteSetting.findUnique({
      where: { key: revKey },
      select: { value: true },
    });

    if (current?.value === entry.revision) continue;

    const alreadyPublishedAtThisRevision = !current && lastFullPublish === entry.revision;
    if (alreadyPublishedAtThisRevision) {
      await prisma.siteSetting.upsert({
        where: { key: revKey },
        create: {
          key: revKey,
          value: entry.revision,
          group: SettingGroup.CONTENT,
          label: `${entry.label} copy revision`,
          type: SettingType.TEXT,
          isPublic: false,
          sortOrder: 498,
        },
        update: { value: entry.revision },
      });
      continue;
    }

    const html = legalMdToHtml(entry.md);
    await prisma.siteSetting.upsert({
      where: { key: entry.key },
      create: {
        key: entry.key,
        value: html,
        group: SettingGroup.CONTENT,
        label: entry.label,
        type: SettingType.TEXTAREA,
        isPublic: true,
        sortOrder: 500,
      },
      update: {
        value: html,
        isPublic: true,
        label: entry.label,
      },
    });
    await prisma.siteSetting.upsert({
      where: { key: entry.updatedKey },
      create: {
        key: entry.updatedKey,
        value: DEFAULT_LEGAL_UPDATED,
        group: SettingGroup.CONTENT,
        label: `${entry.label} last updated`,
        type: SettingType.TEXT,
        isPublic: true,
        sortOrder: 501,
      },
      update: {
        value: DEFAULT_LEGAL_UPDATED,
        isPublic: true,
      },
    });
    await prisma.siteSetting.upsert({
      where: { key: revKey },
      create: {
        key: revKey,
        value: entry.revision,
        group: SettingGroup.CONTENT,
        label: `${entry.label} copy revision`,
        type: SettingType.TEXT,
        isPublic: false,
        sortOrder: 498,
      },
      update: { value: entry.revision },
    });
  }

  await prisma.siteSetting.upsert({
    where: { key: REVISION_KEY },
    create: {
      key: REVISION_KEY,
      value: LEGAL_COPY_REVISION,
      group: SettingGroup.CONTENT,
      label: "Legal copy revision",
      type: SettingType.TEXT,
      isPublic: false,
      sortOrder: 499,
    },
    update: { value: LEGAL_COPY_REVISION },
  });
}
