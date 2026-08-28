/** Canonical Nigerian states for checkout. Lagos detection uses this select, not free text. */
export const NIGERIA_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

export type NigeriaState = (typeof NIGERIA_STATES)[number];

const LAGOS_ALIASES = new Set([
  "lagos",
  "lagos state",
  "lag",
  "la",
  "ikeja",
  "lekki",
  "vi",
  "victoria island",
  "ikoyi",
  "ajah",
  "yaba",
  "surulere",
  "maryland",
  "gbagada",
  "festac",
  "apapa",
  "ajah lagos",
  "ikeja lagos",
]);

export function isLagosState(value: string | null | undefined): boolean {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return false;
  if (raw === "lagos") return true;
  if (LAGOS_ALIASES.has(raw)) return true;
  if (raw.includes("lagos")) return true;
  return false;
}
