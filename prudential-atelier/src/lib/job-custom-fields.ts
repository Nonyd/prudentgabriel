import type { JobType } from "@prisma/client";

export type FieldType =
  | "text"
  | "textarea"
  | "dropdown"
  | "multi_select"
  | "file_upload"
  | "yes_no"
  | "date"
  | "number"
  | "phone"
  | "url"
  | "rating_scale"
  | "section_heading";

export interface CustomField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  minValue?: number;
  maxValue?: number;
  helpText?: string;
  order: number;
}

export type CustomResponses = Record<string, string | string[] | number | boolean>;

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  FREELANCE: "Freelance",
  INTERNSHIP: "Internship",
  IT_PLACEMENT: "IT Placement",
};

export const JOB_TYPE_FILTERS: { value: JobType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "IT_PLACEMENT", label: "IT Placement" },
];

export function parseCustomFields(raw: unknown): CustomField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is CustomField => typeof f === "object" && f !== null && "id" in f && "type" in f)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function validateCustomResponses(
  fields: CustomField[],
  responses: CustomResponses,
): string | null {
  for (const field of fields) {
    if (field.type === "section_heading") continue;
    const value = responses[field.id];
    if (!field.required) continue;

    if (value === undefined || value === null || value === "") {
      return `${field.label} is required`;
    }
    if (Array.isArray(value) && value.length === 0) {
      return `${field.label} is required`;
    }
  }
  return null;
}

export function newCustomField(type: FieldType, order: number): CustomField {
  const id = `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const base: CustomField = {
    id,
    type,
    label: type === "section_heading" ? "Section heading" : "New field",
    required: type !== "section_heading",
    order,
  };
  if (type === "dropdown" || type === "multi_select") {
    base.options = ["Option 1"];
  }
  if (type === "rating_scale") {
    base.minValue = 1;
    base.maxValue = 5;
  }
  return base;
}
