import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { getMediaStore } from "@/lib/media";
import { defaultMediaRoot } from "@/lib/media/local-disk";

/**
 * Slice AZ5 — delete anonymous uploads that were never attached to anything.
 *
 * Careers and consultation uploads land on disk before the form is submitted;
 * an abandoned form (or a spammer) leaves the file behind. Keys are
 * content-addressed (`<vis>/<folder>/<sha256-32>.<ext>`), so a file is
 * attached if its digest appears anywhere in the database. The sweep deletes a
 * file only when it is older than ORPHAN_MIN_AGE_MS AND its digest appears in
 * no row of any table — deliberately broad, so a file referenced from a place
 * this job does not know about (a moodboard copied onto an order, an admin
 * note) is kept.
 */

export const ORPHAN_FOLDERS = ["prudential-atelier/careers", "prudential-atelier/consultations"];
export const ORPHAN_MIN_AGE_MS = 48 * 60 * 60 * 1000;
const DIGEST = /^([0-9a-f]{32})\.[a-z0-9]+$/;
/** Digests per regex; keeps each table scan's pattern bounded. */
const CHUNK = 100;

type Candidate = { key: string; digest: string };

async function listCandidates(root: string, now: number): Promise<{ scanned: number; candidates: Candidate[] }> {
  let scanned = 0;
  const candidates: Candidate[] = [];
  for (const vis of ["private", "public"]) {
    for (const folder of ORPHAN_FOLDERS) {
      const dir = join(root, vis, ...folder.split("/"));
      let names: string[];
      try {
        names = await readdir(dir);
      } catch {
        continue; // folder not created yet
      }
      for (const name of names) {
        const m = DIGEST.exec(name);
        if (!m) continue;
        scanned += 1;
        const s = await stat(join(dir, name)).catch(() => null);
        if (!s?.isFile() || now - s.mtimeMs < ORPHAN_MIN_AGE_MS) continue;
        candidates.push({ key: `${vis}/${folder}/${name}`, digest: m[1] });
      }
    }
  }
  return { scanned, candidates };
}

/** Digests (of those given) that appear in any row of any table. */
export async function referencedDigests(digests: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (digests.length === 0) return found;
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'RateLimitBucket')
  `;
  for (let i = 0; i < digests.length; i += CHUNK) {
    const chunk = digests.slice(i, i + CHUNK);
    const pattern = chunk.join("|"); // hex only, safe as a regex
    for (const { tablename } of tables) {
      const ident = `"${tablename.replace(/"/g, '""')}"`;
      const rows = await prisma.$queryRawUnsafe<{ m: string }[]>(
        `SELECT DISTINCT (regexp_matches(t::text, $1, 'g'))[1] AS m FROM ${ident} t WHERE t::text ~ $1`,
        `(${pattern})`,
      );
      for (const r of rows) found.add(r.m);
    }
  }
  return found;
}

export async function sweepOrphanUploads(opts: {
  root?: string;
  now?: Date;
  isBudgetExhausted?: () => boolean;
  deleteKey?: (key: string) => Promise<void>;
}): Promise<{ scanned: number; candidates: number; deleted: string[]; kept: number }> {
  const root = opts.root ?? defaultMediaRoot();
  const now = (opts.now ?? new Date()).getTime();
  const del = opts.deleteKey ?? ((key: string) => getMediaStore().delete(key));
  const { scanned, candidates } = await listCandidates(root, now);
  const referenced = await referencedDigests(Array.from(new Set(candidates.map((c) => c.digest))));
  const deleted: string[] = [];
  for (const c of candidates) {
    if (opts.isBudgetExhausted?.()) break;
    if (referenced.has(c.digest)) continue;
    await del(c.key);
    deleted.push(c.key);
  }
  return { scanned, candidates: candidates.length, deleted, kept: candidates.length - deleted.length };
}

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const r = await sweepOrphanUploads({ now: ctx.now, isBudgetExhausted: ctx.isBudgetExhausted });
  return {
    processed: r.deleted.length,
    failed: 0,
    hasMore: r.deleted.length + r.kept < r.candidates,
    detail: { scanned: r.scanned, candidates: r.candidates, deleted: r.deleted.length, keptReferenced: r.kept },
  };
}
