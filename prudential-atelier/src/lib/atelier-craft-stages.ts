/**
 * Slice BB2 — /atelier shows the stages of craft, not the administration.
 *
 * The pipeline has thirteen stages (bespoke-stages.ts). The first four —
 * booking, session, invoice, fee — are how the house works, not what it makes:
 * they stay in the pipeline and on her tracking page, and are left off the
 * public list. The heading is counted from the list, so it cannot print a
 * number the list contradicts.
 */
import type { BespokeStage } from "@prisma/client";
import { STAGE_ORDER, STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";

export const ADMINISTRATIVE_STAGES: readonly BespokeStage[] = [
  "CONSULTATION_BOOKING",
  "CONSULTATION_SESSION",
  "INVOICE_ISSUANCE",
  "PAYMENT_CONFIRMATION",
];

export const CRAFT_STAGES: readonly BespokeStage[] = STAGE_ORDER.filter((s) => !ADMINISTRATIVE_STAGES.includes(s));

/** Defaults for the line under each stage. Editable in Admin → Content → Atelier. */
export const CRAFT_STAGE_LINES: Partial<Record<BespokeStage, string>> = {
  SKETCHING_CONCEPT:
    "Your gown is drawn from the conversation: the occasion, the silhouette, how you want to feel in it. You see the sketches before any cloth is cut.",
  FABRIC_SOURCING: "Lace, silk, crepe and beads are chosen for this commission alone.",
  DESIGN_APPROVAL: "The design, the fabric and the embellishment are set down, and nothing is cut until you approve them.",
  TAILORING: "Cut and constructed in our Lagos atelier, to your measurements and no one else's.",
  FIRST_FITTING: "You try the structure before it is finished, so the silhouette is right from the inside out.",
  ALTERATIONS: "Every note from the fitting is worked back into the gown.",
  BEADING_FINISHING: "Beads, stones and embroidery are applied by hand, one at a time.",
  FINAL_FITTING: "A last fitting with everything in place, to confirm it is exactly right.",
  DELIVERY: "Pressed, packed and delivered to you, or ready for you to collect.",
};

export function craftStageLineKey(stage: BespokeStage): string {
  return `atelier_stage_${stage.toLowerCase()}_line`;
}

export type CraftStage = { stage: BespokeStage; label: string; line: string | null };

export function craftStages(cms: Record<string, string> = {}): CraftStage[] {
  return CRAFT_STAGES.map((stage) => {
    const custom = cms[craftStageLineKey(stage)]?.trim();
    return {
      stage,
      label: STAGE_SHORT_LABELS[stage],
      line: custom || CRAFT_STAGE_LINES[stage] || null,
    };
  });
}

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

export function countWord(n: number): string {
  const word = NUMBER_WORDS[n] ?? String(n);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Every count a heading states: "Thirteen stages" → [13], "13 steps" → [13].
 * "One" is left out: in a heading it is almost never a count ("one gown").
 */
function statedCounts(text: string): number[] {
  const out: number[] = (text.match(/\b\d+\b/g) ?? []).map(Number);
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const w of words) {
    const i = NUMBER_WORDS.indexOf(w);
    if (i > 1) out.push(i);
  }
  return out;
}

export const DEFAULT_PROCESS_HEADLINE = "{count} stages of craft";

/**
 * The heading over the stage list. "{count}" becomes the number of stages
 * shown. A heading from the CMS that states any other number is not printed:
 * the default, counted, is used instead.
 */
export function processHeadline(cmsValue: string | null | undefined, count: number): string {
  const raw = cmsValue?.trim() || DEFAULT_PROCESS_HEADLINE;
  const filled = raw.replace(/\{count\}/g, (_m, at: number) =>
    at === 0 ? countWord(count) : countWord(count).toLowerCase(),
  );
  const stated = statedCounts(filled);
  if (stated.some((n) => n !== count)) {
    return DEFAULT_PROCESS_HEADLINE.replace("{count}", countWord(count));
  }
  return filled;
}
