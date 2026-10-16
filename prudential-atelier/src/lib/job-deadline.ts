import type { JobType } from "@prisma/client";

/** IT placements take applications all year round: they never have a deadline. */
export function jobTakesDeadline(type: JobType | string): boolean {
  return type !== "IT_PLACEMENT";
}

/** The deadline that applies to a posting, or null (none set, or an IT placement). */
export function effectiveDeadline(job: { type: JobType | string; deadline: Date | string | null }): Date | null {
  if (!jobTakesDeadline(job.type) || !job.deadline) return null;
  return new Date(job.deadline);
}

export function applicationsClosed(job: { type: JobType | string; deadline: Date | string | null }, now = new Date()): boolean {
  const d = effectiveDeadline(job);
  return d !== null && d < now;
}
