import { PrismaClient, SettingGroup, SettingType } from "@prisma/client";
import { LEGAL_SEED_ENTRIES, legalMdToHtml } from "./legal-content";

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
    console.log(`  ✓ ${entry.label}`);
  }

  console.log("Done — 5 legal pages seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
