/**
 * PLACEHOLDER atelier content (src/lib/atelier-demo-content.ts), so /atelier
 * can be judged with names, words and prices in it. Staging only, once.
 *
 * - Deletes the gallery rows that repeat another row's file (the file stays).
 * - Groups each gown's photographs under its main photograph.
 * - Gives each gown's main photograph an invented title, description and price
 *   floor, marked `placeholder`: flagged in Admin -> Gallery, cleared when the
 *   house saves its own values, never rendered on the production site.
 * - Never touches a gown the house has already written.
 *
 * Refuses production; on the staging site it needs the staging database. Runs
 * once: a SiteSetting records what it did, and a second run does nothing.
 *
 *   The staging container entrypoint runs it.
 *   Laptop (scratch database): ALLOW_FIXTURES=true tsx --tsconfig tsconfig.scripts.json scripts/seed-atelier-demo.ts
 */
import { createRequire } from "node:module";
import path from "node:path";
import { GalleryCategory, SettingGroup, SettingType } from "@prisma/client";
import { DEMO_CONTENT_MARKER, demoSeedRefusal, planDemoContent } from "../src/lib/atelier-demo-content";
import { looksLikeProductionDatabase, looksLikeStagingDatabase } from "./fixture-guard";

try {
  const require = createRequire(import.meta.url);
  const dotenv = require("dotenv") as { config: (opts: { path: string }) => void };
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
} catch {
  /* runtime image */
}

async function main() {
  const refusal = demoSeedRefusal({
    siteUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL,
    productionDb: looksLikeProductionDatabase(),
    stagingDb: looksLikeStagingDatabase(),
    allowFixtures: process.env.ALLOW_FIXTURES === "true",
  });
  if (refusal) {
    console.log(`[atelier-demo] not applied: ${refusal}.`);
    return;
  }

  const { prisma } = await import("../src/lib/prisma");
  try {
    const done = await prisma.siteSetting.findUnique({ where: { key: DEMO_CONTENT_MARKER } });
    if (done) {
      console.log(`[atelier-demo] already applied (${done.value.slice(0, 80)}); nothing to do.`);
      return;
    }

    const rows = await prisma.galleryImage.findMany({
      where: { category: GalleryCategory.ATELIER, isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true, url: true, caption: true, description: true, priceFloorNGN: true, priceCeilingNGN: true, pieceOfId: true },
    });
    const plan = planDemoContent(rows);

    await prisma.$transaction(async (tx) => {
      // A duplicate's frames (none today) move to the row that keeps the file; the file itself stays.
      for (const id of plan.deleteDuplicates) {
        const url = rows.find((r) => r.id === id)!.url;
        const keeper = rows.find((r) => r.url === url && !plan.deleteDuplicates.includes(r.id))!;
        await tx.galleryImage.updateMany({ where: { pieceOfId: id }, data: { pieceOfId: keeper.id } });
        await tx.galleryImage.delete({ where: { id } });
      }
      for (const g of plan.group) {
        await tx.galleryImage.update({ where: { id: g.id }, data: { pieceOfId: g.pieceOfId } });
      }
      for (const f of plan.fill) {
        await tx.galleryImage.update({
          where: { id: f.id },
          data: {
            caption: f.caption,
            description: f.description,
            priceFloorNGN: f.priceFloorNGN,
            priceCeilingNGN: null,
            placeholder: true,
          },
        });
      }
      await tx.siteSetting.create({
        data: {
          key: DEMO_CONTENT_MARKER,
          value: JSON.stringify({
            appliedAt: new Date().toISOString(),
            deleted: plan.deleteDuplicates.length,
            grouped: plan.group.length,
            filled: plan.fill.map((f) => `${f.gown}:${f.caption}`),
            skipped: plan.skipped,
          }),
          group: SettingGroup.CONTENT,
          label: "Atelier demo content applied (placeholder; see docs/ATELIER_PAGE_CHECKLIST.md)",
          type: SettingType.JSON,
        },
      });
    });

    // The entrypoint runs this before the server starts, so /atelier's first render has it.
    console.log(
      `[atelier-demo] applied: ${plan.deleteDuplicates.length} duplicate rows deleted, ${plan.group.length} photographs grouped, ` +
        `${plan.fill.length} gowns given PLACEHOLDER words and floors (${plan.fill.map((f) => f.caption).join(", ")})` +
        (plan.skipped.length ? `; skipped ${plan.skipped.map((s) => `${s.gown} (${s.reason})`).join(", ")}` : ""),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[atelier-demo] ERROR:", e);
  process.exitCode = 1;
});
