/**
 * Compare sanitizeCmsHtml against live HTML rows dumped from VPS Postgres.
 *
 *   pnpm exec tsx --tsconfig tsconfig.scripts.json scripts/scan-cms-sanitize.ts < cms-dump.json
 */
import { readFileSync } from "node:fs";
import { sanitizeCmsHtml } from "../src/lib/sanitize-html";

type Row = { kind: string; id: string; html: string };

function tags(html: string): string[] {
  const found = new Set<string>();
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) found.add(m[1].toLowerCase());
  return Array.from(found).sort();
}

function attrs(html: string): string[] {
  const found = new Set<string>();
  const re = /<[^>]+\s([a-zA-Z:_][\w:.-]*)\s*=/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) found.add(m[1].toLowerCase());
  return Array.from(found).sort();
}

const raw = readFileSync(0, "utf8").trim();
const rows = JSON.parse(raw) as Row[];
let changed = 0;
for (const row of rows) {
  const out = sanitizeCmsHtml(row.html);
  if (out === row.html) continue;
  changed += 1;
  const lostTags = tags(row.html).filter((t) => !tags(out).includes(t));
  const lostAttrs = attrs(row.html).filter((a) => !attrs(out).includes(a));
  console.log(
    JSON.stringify({
      kind: row.kind,
      id: row.id,
      changed: true,
      lostTags,
      lostAttrs,
      inLen: row.html.length,
      outLen: out.length,
    }),
  );
}
console.log(
  JSON.stringify({
    scanned: rows.length,
    unchanged: rows.length - changed,
    sanitizedDiffers: changed,
  }),
);
if (changed === 0) {
  console.log("OK — every dumped row is unchanged by sanitizeCmsHtml");
}
