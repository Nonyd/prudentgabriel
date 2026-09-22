/**
 * Slice AZ5: public upload caps and the orphan-upload sweep.
 *
 *   pnpm test:upload-limits
 *
 * The sweep check needs a database (it scans every table for references); it is
 * skipped when DATABASE_URL is unreachable (CI). It only touches a temp dir.
 */
import "./preload-test-env";
import { mkdtemp, mkdir, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { createLocalDiskMediaStore } from "../src/lib/media/local-disk";
import { ORPHAN_MIN_AGE_MS, sweepOrphanUploads } from "../src/lib/cron/jobs/orphan-uploads";
import { RECEIPT_UPLOADS_PER_TICKET, receiptTicketCapOr429 } from "../src/lib/upload-limits";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const src = (rel: string) => readFileSync(path.join(__dirname, "..", rel), "utf8");

function staticGuard() {
  for (const [rel, route] of [
    ["src/app/api/careers/upload/route.ts", "careers-upload"],
    ["src/app/api/consultations/upload/route.ts", "consultations-upload"],
    ["src/app/api/upload/receipt/route.ts", "receipt-upload"],
    ["src/app/api/upload/receipt/ticket/route.ts", "receipt-ticket"],
    ["src/app/api/invoice/[token]/receipt/route.ts", "invoice-receipt-upload"],
  ]) {
    assert(src(rel).includes(`dailyUploadCapOr429("${route}")`), `${rel} applies the ${route} daily cap`);
  }
  assert(src("src/app/api/upload/receipt/route.ts").includes("receiptTicketCapOr429("), "guest receipts are capped per ticket");
  console.log("ok static: every public upload route has a daily cap");
}

async function ticketCap() {
  const ticket = `test-ticket-${Date.now()}-${Math.random()}`;
  const exp = Date.now() + 30 * 60 * 1000;
  for (let i = 0; i < RECEIPT_UPLOADS_PER_TICKET; i++) {
    assert((await receiptTicketCapOr429(ticket, exp)) === null, `ticket upload ${i + 1} allowed`);
  }
  const over = await receiptTicketCapOr429(ticket, exp);
  assert(over?.status === 429, `upload ${RECEIPT_UPLOADS_PER_TICKET + 1} on one ticket is refused`);
  console.log(`ok ticket cap: ${RECEIPT_UPLOADS_PER_TICKET} uploads per ticket`);
}

async function databaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function sweep() {
  const root = await mkdtemp(path.join(tmpdir(), "az5-media-"));
  const dir = path.join(root, "private", "prudential-atelier", "careers");
  await mkdir(dir, { recursive: true });
  const rnd = () => randomBytes(16).toString("hex");
  const oldOrphan = `${rnd()}.pdf`;
  const oldReferenced = `${rnd()}.pdf`;
  const young = `${rnd()}.pdf`;
  for (const n of [oldOrphan, oldReferenced, young, "notes.txt"]) await writeFile(path.join(dir, n), "x");
  const old = new Date(Date.now() - ORPHAN_MIN_AGE_MS - 60_000);
  for (const n of [oldOrphan, oldReferenced, "notes.txt"]) await utimes(path.join(dir, n), old, old);

  // Reference one file from an arbitrary table: any row anywhere keeps it.
  const ref = await prisma.cspViolation.create({
    data: { directive: "az5-test", blockedOrigin: "az5-test", documentPath: `/media/private/prudential-atelier/careers/${oldReferenced}` },
  });
  try {
    const store = createLocalDiskMediaStore(root);
    const r = await sweepOrphanUploads({ root, deleteKey: (k) => store.delete(k) });
    const left = await readdir(dir);
    assert(!left.includes(oldOrphan), "old unreferenced upload deleted");
    assert(left.includes(oldReferenced), "old upload referenced anywhere in the database is kept");
    assert(left.includes(young), "upload younger than 48h is kept");
    assert(left.includes("notes.txt"), "files that are not media keys are ignored");
    assert(r.deleted.length === 1, `exactly one deletion (${r.deleted.join(", ")})`);
  } finally {
    await prisma.cspViolation.delete({ where: { id: ref.id } });
    await rm(root, { recursive: true, force: true });
  }
  console.log("ok sweep: only old, unreferenced uploads are deleted");
}

async function main() {
  staticGuard();
  await ticketCap();
  if (await databaseReachable()) await sweep();
  else console.log("skip sweep: database unreachable");
  console.log("OK test-upload-limits");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
