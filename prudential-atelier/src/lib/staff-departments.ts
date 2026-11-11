/** Departments a staff member can belong to, in the order the dropdowns show them. Mirrors the StaffDepartment enum. */
export const STAFF_DEPARTMENTS = [
  "TAILOR",
  "BEADER",
  "DESIGNER",
  "PATTERN_CUTTER",
  "ASSISTANT_CREATIVE_DESIGNER",
  "SUPERVISOR",
  "ILLUSTRATOR",
  "QUALITY_CONTROL",
  "PRODUCTION_MANAGER",
  "CREATIVE_ADMIN",
  "STORE_KEEPER",
  "CREATIVE_TEAM",
  "GENERAL",
] as const;

export type StaffDepartmentKey = (typeof STAFF_DEPARTMENTS)[number];

/**
 * The Creative Team (asked for on 11 November 2026). Everyone in it sees every
 * client order and its whole file, read-only; the Illustrator may also add
 * sketches. CREATIVE_TEAM is the earlier catch-all value, kept so nobody
 * already filed under it loses access.
 */
export const CREATIVE_TEAM_DEPARTMENTS: readonly StaffDepartmentKey[] = [
  "ASSISTANT_CREATIVE_DESIGNER",
  "SUPERVISOR",
  "ILLUSTRATOR",
  "QUALITY_CONTROL",
  "PRODUCTION_MANAGER",
  "CREATIVE_ADMIN",
  "STORE_KEEPER",
  "CREATIVE_TEAM",
];

export function isCreativeTeamDepartment(d: string | null | undefined): boolean {
  return (CREATIVE_TEAM_DEPARTMENTS as readonly string[]).includes(d ?? "");
}

const LABELS: Partial<Record<StaffDepartmentKey, string>> = {
  CREATIVE_ADMIN: "Admin (Creative Team)",
  CREATIVE_TEAM: "Creative Team (general)",
};

export function departmentLabel(d: string): string {
  const l = LABELS[d as StaffDepartmentKey];
  if (l) return l;
  return d.charAt(0) + d.slice(1).toLowerCase().replace(/_/g, " ");
}

/** For the dropdowns: the workroom, then the Creative Team as its own group. */
export const DEPARTMENT_GROUPS: { label: string; items: readonly StaffDepartmentKey[] }[] = [
  { label: "Workroom", items: STAFF_DEPARTMENTS.filter((d) => !isCreativeTeamDepartment(d) && d !== "GENERAL") },
  { label: "Creative Team", items: CREATIVE_TEAM_DEPARTMENTS },
  { label: "Other", items: ["GENERAL"] },
];
