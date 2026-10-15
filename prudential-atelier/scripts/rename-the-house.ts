/**
 * One-off: the brand is "Prudent Gabriel", not "the house". The code defaults are
 * already renamed; this rewrites copies saved in SiteSetting (legal pages, invoice
 * terms, CMS text, admin-edited email templates).
 *
 *   pnpm tsx --tsconfig tsconfig.scripts.json scripts/rename-the-house.ts          # dry run
 *   pnpm tsx --tsconfig tsconfig.scripts.json scripts/rename-the-house.ts --apply  # write
 *
 * Cached settings refresh within the hour (or on restart).
 */
import { prisma } from "../src/lib/prisma";

const KEEP = "\u0000HOP";

// Same rules as the code rename. Order matters: specific phrases first.
const RULES: [RegExp, string][] = [
  [/a member of the house/g, "a member of the Prudent Gabriel team"],
  [/smallest of the house/g, "smallest of the Prudent Gabriel family"],
  [/smallest members of the house/g, "smallest members of the Prudent Gabriel family"],
  [/The house chart/g, "The Prudent Gabriel size chart"],
  [/the house production/g, "Prudent Gabriel's production"],
  [/the house accounts/g, "the Prudent Gabriel accounts"],
  [/the house chart/g, "the Prudent Gabriel size chart"],
  [/the house library/g, "the Prudent Gabriel library"],
  [/The house default/g, "The Prudent Gabriel default"],
  [/[Tt]he house's/g, "Prudent Gabriel's"],
  [/THE HOUSE/g, "PRUDENT GABRIEL"],
  [/[Tt]he [Hh]ouse of Prudent Gabriel/g, KEEP],
  [/The House/g, "Prudent Gabriel"],
  [/\b[Tt]he house\b/g, "Prudent Gabriel"],
];

export function renameTheHouse(text: string): string {
  const kept = text.match(/[Tt]he [Hh]ouse of Prudent Gabriel/)?.[0] ?? "The House of Prudent Gabriel";
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out.split(KEEP).join(kept);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await prisma.siteSetting.findMany({
    where: { value: { contains: "house", mode: "insensitive" } },
    select: { key: true, value: true },
  });
  let changed = 0;
  for (const row of rows) {
    const next = renameTheHouse(row.value);
    if (next === row.value) continue;
    changed++;
    console.log(`${apply ? "updated" : "would update"}: ${row.key}`);
    if (apply) await prisma.siteSetting.update({ where: { key: row.key }, data: { value: next } });
  }
  console.log(`${changed} setting(s) ${apply ? "updated" : "to update (dry run; pass --apply)"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
