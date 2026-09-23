/**
 * Key rotation: rewrite every encrypted column (src/lib/encrypted-columns.ts)
 * under the current ENCRYPTION_KEY, reading old values with ENCRYPTION_KEY_PREVIOUS.
 * Idempotent: a value already under the current key is left alone.
 *
 * The entrypoint runs it whenever ENCRYPTION_KEY_PREVIOUS is set. Exit code 1 if
 * any value could not be read with any key: do not retire the old key then.
 *
 *   tsx --tsconfig tsconfig.scripts.json scripts/reencrypt-secrets.ts [--check]
 *   --check  count only, write nothing
 */
import { createRequire } from "node:module";
import path from "node:path";

// Laptop only; the image already has the keys. Never falls back to a test key.
try {
  const require = createRequire(import.meta.url);
  const dotenv = require("dotenv") as { config: (opts: { path: string }) => void };
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
} catch {
  /* runtime image */
}

export async function reencryptAll(opts: { write: boolean }): Promise<{ rewritten: number; current: number; unreadable: string[] }> {
  const { prisma } = await import("../src/lib/prisma");
  const { reencryptIfNeeded, isEncrypted } = await import("../src/lib/encryption");
  const { ENCRYPTED_COLUMNS } = await import("../src/lib/encrypted-columns");

  let rewritten = 0;
  let current = 0;
  const unreadable: string[] = [];
  for (const c of ENCRYPTED_COLUMNS) {
    // Identifiers come from the registry in this repo, never from input.
    const rows = await prisma.$queryRawUnsafe<{ id: string; v: string }[]>(
      `SELECT "id", "${c.column}" AS v FROM "${c.model}" WHERE "${c.column}" IS NOT NULL`,
    );
    for (const row of rows) {
      if (!isEncrypted(row.v)) {
        if (!c.prefixOnly) unreadable.push(`${c.model}.${c.column} ${row.id} (not ciphertext)`);
        continue;
      }
      let next: string | null;
      try {
        next = reencryptIfNeeded(row.v);
      } catch {
        unreadable.push(`${c.model}.${c.column} ${row.id}`);
        continue;
      }
      if (next === null) {
        current++;
        continue;
      }
      rewritten++;
      if (opts.write) {
        await prisma.$executeRawUnsafe(
          `UPDATE "${c.model}" SET "${c.column}" = $1 WHERE "id" = $2 AND "${c.column}" = $3`,
          next,
          row.id,
          row.v,
        );
      }
    }
  }
  return { rewritten, current, unreadable };
}

async function main() {
  if (!(process.env.ENCRYPTION_KEY ?? process.env.SETTINGS_ENCRYPTION_KEY ?? "").trim()) {
    throw new Error("ENCRYPTION_KEY is not set.");
  }
  const write = !process.argv.includes("--check");
  const r = await reencryptAll({ write });
  console.log(
    `[reencrypt] ${write ? "rewrote" : "would rewrite"} ${r.rewritten}; already under the current key ${r.current}; unreadable ${r.unreadable.length}`,
  );
  for (const u of r.unreadable.slice(0, 20)) console.log(`[reencrypt] unreadable: ${u}`);
  const { prisma } = await import("../src/lib/prisma");
  await prisma.$disconnect();
  if (r.unreadable.length) process.exit(1);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/reencrypt-secrets.ts")) {
  main().catch((err) => {
    console.error("[reencrypt] FAILED:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
