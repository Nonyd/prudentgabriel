/**
 * Extra atelier measurement fields: stable keys, the shop's custom-size values
 * kept when atelier ones are saved, and only sane numbers accepted.
 *
 *   pnpm test:atelier-measurement-fields
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  atelierExtrasFrom,
  atelierFieldKey,
  cleanAtelierExtraInput,
  cleanAtelierFields,
  mergeAtelierExtras,
} from "../src/lib/atelier/measurement-fields-shared";
import { cleanMeasurementInput, measurementFromRecord } from "../src/lib/measurements";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p: string) => readFileSync(join(root, p), "utf8");

assert(atelierFieldKey("Bicep", []) === "atelier_bicep", "a key is made from the name");
assert(atelierFieldKey("Back length!", []) === "atelier_back_length", "punctuation and spaces fold");
assert(atelierFieldKey("Bicep", ["atelier_bicep"]) === "atelier_bicep_2", "a taken key gets a number");

const fields = cleanAtelierFields([
  { key: "atelier_bicep", label: " Bicep ", help: "Fullest part" },
  { key: "atelier_bicep", label: "Dup" },
  { key: "bust", label: "Not ours" },
  { key: "atelier_wrist", label: "Wrist", retired: true },
]);
assert(fields.length === 2 && fields[0]!.label === "Bicep" && fields[1]!.retired === true, "fields cleaned, duplicates and foreign keys dropped");

const values = { chest_cm: 90, atelier_bicep: 12 };
assert(JSON.stringify(atelierExtrasFrom(values)) === JSON.stringify({ atelier_bicep: 12 }), "only atelier extras are read");
const merged = mergeAtelierExtras(values, { atelier_bicep: null, atelier_wrist: 6.5, bust: 40 } as Record<string, number | null>);
assert(merged.chest_cm === 90, "the shop's custom-size values are kept");
assert(!("atelier_bicep" in merged) && merged.atelier_wrist === 6.5, "null clears, a number sets");
assert(!("bust" in merged), "a non-atelier key is never written as an extra");

assert(!cleanAtelierExtraInput({ atelier_bicep: -3 }).ok, "a negative measurement is refused");
assert(!cleanAtelierExtraInput({ atelier_bicep: "abc" }).ok, "text is refused");
const ok = cleanAtelierExtraInput({ atelier_bicep: "12.345", atelier_wrist: "", other: 5 });
assert(ok.ok && ok.extra.atelier_bicep === 12.35 && ok.extra.atelier_wrist === null && !("other" in ok.extra), "input cleaned");

const input = cleanMeasurementInput({ bust: 36, unit: "inches", extra: { atelier_bicep: 11 } });
assert(input.ok && input.extra.atelier_bicep === 11 && !("extra" in input.data), "extras travel apart from the columns");
assert(measurementFromRecord({ bust: 36, values })?.extra?.atelier_bicep === 12, "a saved set carries its extras");

const route = src("src/app/api/atelier/measurement-fields/route.ts");
assert(route.includes('requireAdminApi("bespoke")'), "atelier managers and admins change the list");
assert(route.includes("requireStaffPortal()"), "every measurement form can read it");
assert(!src("src/lib/measurements.ts").includes("@/lib/settings"), "the shared measurement helpers stay browser-safe");

console.log("test-atelier-measurement-fields: ok");
