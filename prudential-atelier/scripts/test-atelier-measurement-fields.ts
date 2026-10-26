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
  DEFAULT_ATELIER_SHEET,
  measurementSheetRows,
  mergeAtelierExtras,
  textFieldKeys,
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
  { key: "shop_chest", label: "Not ours" },
  { key: "atelier_wrist", label: "Wrist", retired: true },
]);
assert(fields.length === 2 && fields[0]!.label === "Bicep" && fields[1]!.retired === true, "fields cleaned, duplicates and foreign keys dropped");

// The sheet can name a standard column under the house's word for it; only an atelier field is text.
const sheetish = cleanAtelierFields([
  { key: "bust", label: "Bust circumference", type: "text" },
  { key: "atelier_cup_size", label: "Cup size", type: "text" },
]);
assert(sheetish[0]!.key === "bust" && sheetish[0]!.label === "Bust circumference", "a standard column on the sheet keeps its key");
assert(!sheetish[0]!.type && sheetish[1]!.type === "text", "a standard column is never text; cup size is");

// The house sheet: 24 measurements in the order the atelier takes them.
assert(DEFAULT_ATELIER_SHEET.length === 24, "24 measurements");
assert(
  DEFAULT_ATELIER_SHEET.map((f) => f.label).join("|") ===
    [
      "Shoulder", "Bust circumference", "Under-bust circumference", "Bust point", "Under-bust point",
      "Front half length", "Bust span", "Back half length", "Waist", "Armhole circumference",
      "Biceps circumference", "Elbow circumference", "Wrist circumference", "Arm's eye", "Shoulder to elbow",
      "Shoulder to wrist", "Hips", "Waist to knee", "Waist to ankle", "Knee circumference", "Across chest",
      "Across back", "Round neck", "Cup size",
    ].join("|"),
  "in the house's order",
);
assert(
  ["shoulderWidth", "bust", "waist", "armhole", "hips", "neck"].every((k) => DEFAULT_ATELIER_SHEET.some((f) => f.key === k)),
  "the six it shares with the standard columns keep figures already taken",
);
assert(cleanAtelierFields(DEFAULT_ATELIER_SHEET).length === 24, "the default sheet survives its own cleaning");

// Shown in sheet order; a standard column off the sheet still shows if the set holds it.
const rows = measurementSheetRows(DEFAULT_ATELIER_SHEET, {
  bust: 36,
  shoulderWidth: 15,
  sleeveLength: 22,
  extra: { atelier_cup_size: "34C", atelier_bust_point: 10 },
});
assert(rows.map((r) => r.key).join() === "shoulderWidth,bust,atelier_bust_point,atelier_cup_size,sleeveLength", "sheet order, then off-sheet");
assert(rows.find((r) => r.key === "atelier_cup_size")!.text, "cup size reads as words");
assert(rows.find((r) => r.key === "sleeveLength")!.notAsked, "sleeve is marked no longer asked");

// Words only where the sheet says text.
const textKeys = textFieldKeys(DEFAULT_ATELIER_SHEET);
const cup = cleanAtelierExtraInput({ atelier_cup_size: " 34C " }, textKeys);
assert(cup.ok && cup.extra.atelier_cup_size === "34C", "cup size kept as words");
assert(!cleanAtelierExtraInput({ atelier_bust_point: "abc" }, textKeys).ok, "words in a length field are refused");
assert(!cleanAtelierExtraInput({ atelier_cup_size: "x".repeat(30) }, textKeys).ok, "a long text is refused");
assert(atelierExtrasFrom({ atelier_cup_size: "34C" }).atelier_cup_size === "34C", "a saved size reads back");

const values = { chest_cm: 90, atelier_bicep: 12 };
assert(JSON.stringify(atelierExtrasFrom(values)) === JSON.stringify({ atelier_bicep: 12 }), "only atelier extras are read");
const merged = mergeAtelierExtras(values, { atelier_bicep: null, atelier_wrist: 6.5, bust: 40 } as Record<string, number | null>);
assert(merged.chest_cm === 90, "the shop's custom-size values are kept");
assert(!("atelier_bicep" in merged) && merged.atelier_wrist === 6.5, "null clears, a number sets");
assert(!("bust" in merged), "a non-atelier key is never written as an extra");

assert(!cleanAtelierExtraInput({ atelier_bicep: -3 }).ok, "a negative measurement is refused");
assert(!cleanAtelierExtraInput({ atelier_bicep: "abc" }, new Set()).ok, "text is refused where no field is text");
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
