/**
 * One-off: email templates are seeded into SiteSetting, and a saved row wins over
 * the code default. After the copy in admin-email-catalog.ts changes, this brings
 * every row that nobody has edited (updatedBy "seed") up to the new default.
 * Rows an admin has edited are left alone and listed.
 *
 *   pnpm tsx --tsconfig tsconfig.scripts.json scripts/refresh-email-templates.ts          # dry run
 *   pnpm tsx --tsconfig tsconfig.scripts.json scripts/refresh-email-templates.ts --apply  # write
 */
import { prisma } from "../src/lib/prisma";
import {
  EMAIL_TEMPLATE_CATALOG,
  EMAIL_TEMPLATE_FIELD_SUFFIXES,
  emailSettingKey,
} from "../src/lib/admin-email-catalog";

async function main() {
  const apply = process.argv.includes("--apply");
  let updated = 0;
  const editedByAdmin = new Set<string>();

  for (const meta of EMAIL_TEMPLATE_CATALOG) {
    for (const field of EMAIL_TEMPLATE_FIELD_SUFFIXES) {
      const key = emailSettingKey(meta.key, field);
      const row = await prisma.siteSetting.findUnique({ where: { key }, select: { value: true, updatedBy: true } });
      if (!row) continue; // Not saved: the code default already applies.
      const next = meta.defaults[field];
      if (row.value === next) continue;
      if (row.updatedBy !== "seed") {
        editedByAdmin.add(`${meta.key} (${row.updatedBy ?? "unknown"})`);
        continue;
      }
      updated++;
      if (apply) await prisma.siteSetting.update({ where: { key }, data: { value: next } });
    }
  }

  console.log(`${updated} field(s) ${apply ? "updated" : "to update (dry run; pass --apply)"}`);
  if (editedByAdmin.size) {
    console.log("Left as edited by an admin (update these by hand in Admin → Email templates):");
    for (const k of editedByAdmin) console.log(`  ${k}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
