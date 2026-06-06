import { PrismaClient, SettingGroup, SettingType } from "@prisma/client";
import { getDefaultValues, getPageById } from "../src/lib/cms-config";

const prisma = new PrismaClient();

const PAGE_IDS = ["contact", "size-guide", "about"] as const;

function fieldMeta(key: string): { label: string; type: SettingType } {
  for (const pageId of PAGE_IDS) {
    const page = getPageById(pageId);
    if (!page) continue;
    for (const section of page.sections) {
      for (const field of section.fields) {
        if (field.key === key) {
          const typeMap: Record<string, SettingType> = {
            text: SettingType.TEXT,
            textarea: SettingType.TEXTAREA,
            toggle: SettingType.TEXT,
            number: SettingType.TEXT,
            select: SettingType.TEXT,
            image: SettingType.TEXT,
            richtext: SettingType.TEXTAREA,
            messages: SettingType.TEXTAREA,
            links: SettingType.TEXTAREA,
            carousel: SettingType.TEXTAREA,
          };
          return { label: field.label, type: typeMap[field.type] ?? SettingType.TEXT };
        }
      }
    }
  }
  return { label: key, type: SettingType.TEXT };
}

async function main() {
  console.log("Seeding Contact, Size Guide, and About page content…");

  const defaults = getDefaultValues();
  const keys = new Set<string>();
  for (const pageId of PAGE_IDS) {
    const page = getPageById(pageId);
    if (!page) continue;
    for (const section of page.sections) {
      for (const field of section.fields) {
        keys.add(field.key);
      }
    }
  }

  for (const key of Array.from(keys)) {
    const value = defaults[key] ?? "";
    const meta = fieldMeta(key);
    await prisma.siteSetting.upsert({
      where: { key },
      create: {
        key,
        value,
        group: SettingGroup.CONTENT,
        label: meta.label,
        type: meta.type,
        isPublic: true,
        sortOrder: 400,
      },
      update: {
        value,
        isPublic: true,
        label: meta.label,
      },
    });
    console.log(`  ✓ ${key}`);
  }

  console.log(`Done — ${keys.size} page settings seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
