import { PrismaClient, SettingGroup, SettingType } from "@prisma/client";
import { DEFAULT_LEGAL_UPDATED, LEGAL_COPY_REVISION, LEGAL_SEED_ENTRIES, legalMdToHtml } from "../src/lib/legal-copy";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding legal page content…");

  for (const entry of LEGAL_SEED_ENTRIES) {
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
    const pageRevKey = `legal_page_revision_${entry.page}`;
    await prisma.siteSetting.upsert({
      where: { key: pageRevKey },
      create: {
        key: pageRevKey,
        value: entry.revision,
        group: SettingGroup.CONTENT,
        label: `${entry.label} copy revision`,
        type: SettingType.TEXT,
        isPublic: false,
        sortOrder: 498,
      },
      update: { value: entry.revision },
    });
    console.log(`  ✓ ${entry.label}`);
  }

  await prisma.siteSetting.upsert({
    where: { key: "legal_copy_revision" },
    create: {
      key: "legal_copy_revision",
      value: LEGAL_COPY_REVISION,
      group: SettingGroup.CONTENT,
      label: "Legal copy revision",
      type: SettingType.TEXT,
      isPublic: false,
      sortOrder: 499,
    },
    update: { value: LEGAL_COPY_REVISION },
  });

  console.log("Done — 5 legal pages seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
