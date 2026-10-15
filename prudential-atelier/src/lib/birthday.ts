/**
 * Birthdays without the year: day and month only, kept on the user. Every
 * account (client, staff, admin) can set one; a daily job sends the wish.
 * Days are judged in Lagos time (WAT, UTC+1, no daylight saving).
 */

export const BIRTHDAY_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Days in each month, allowing 29 February. */
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export type Birthday = { day: number; month: number };

export function isValidBirthday(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= MONTH_DAYS[month - 1]!;
}

export function daysInBirthdayMonth(month: number): number {
  return MONTH_DAYS[month - 1] ?? 31;
}

/** "14 October" */
export function birthdayLabel(day: number, month: number): string {
  return `${day} ${BIRTHDAY_MONTHS[month - 1] ?? ""}`.trim();
}

function lagosToday(now: Date): { year: number; month: number; day: number } {
  const wat = new Date(now.getTime() + 60 * 60 * 1000);
  return { year: wat.getUTCFullYear(), month: wat.getUTCMonth() + 1, day: wat.getUTCDate() };
}

export function lagosYear(now: Date): number {
  return lagosToday(now).year;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Is today (in Lagos) this birthday? 29 February is celebrated on 28 February in other years. */
export function isBirthdayToday(birthday: Birthday, now: Date): boolean {
  const today = lagosToday(now);
  if (birthday.month === 2 && birthday.day === 29 && !isLeapYear(today.year)) {
    return today.month === 2 && today.day === 28;
  }
  return today.month === birthday.month && today.day === birthday.day;
}
