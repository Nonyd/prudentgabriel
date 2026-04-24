import {
  type Consultant,
  type ConsultantOffering,
  ConsultationDeliveryMode,
  ConsultationStatus,
  ConsultationSessionType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { convertFromNGN, formatPrice, getExchangeRates, type ShopCurrency } from "@/lib/currency";

const WAT_TZ = "Africa/Lagos";

export function generateBookingNumber(): string {
  const yy = String(new Date().getFullYear()).slice(-2);
  const n = Math.floor(Math.random() * 99999) + 1;
  return `CB-${yy}-${String(n).padStart(5, "0")}`;
}

/** True when admin must confirm (Mrs. Prudent modes or flagship consultant). */
export function isManualFlow(
  deliveryMode: ConsultationDeliveryMode,
  consultantIsFlagship: boolean,
): boolean {
  if (consultantIsFlagship) return true;
  return (
    deliveryMode === ConsultationDeliveryMode.VIRTUAL_WITH_PRUDENT ||
    deliveryMode === ConsultationDeliveryMode.INPERSON_ATELIER_PRUDENT ||
    deliveryMode === ConsultationDeliveryMode.INPERSON_HOME_PRUDENT
  );
}

export function getWatYmd(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WAT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${day}`;
}

export function dateToWatYmd(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WAT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/** ISO date strings sort same as calendar order for YYYY-MM-DD */
export function ymdCompare(a: string, b: string): number {
  return a.localeCompare(b);
}

export function addDaysToWatYmd(ymd: string, days: number): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return getWatYmd(dt);
}

function parseYmdToWatNoon(ymd: string): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  if (!y || !mo || !d) return new Date(NaN);
  return new Date(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00+01:00`);
}

function watDayOfWeekFromYmd(ymd: string): number {
  return parseYmdToWatNoon(ymd).getDay();
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseDateParamToUtcDay(ymd: string): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

/** Next calendar day in WAT after today (today exclusive for "tomorrow" rule). */
export function getWatTomorrowYmd(): string {
  const today = getWatYmd();
  const [y, m, d] = today.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0, 0));
  return getWatYmd(next);
}

export async function getAvailableSlots(
  consultantId: string,
  dateYmd: string,
  durationMinutes: number,
): Promise<string[]> {
  const dayOfWeek = watDayOfWeekFromYmd(dateYmd);
  const dayStart = parseDateParamToUtcDay(dateYmd);

  const consultant = await prisma.consultant.findUnique({
    where: { id: consultantId },
    include: {
      availability: { where: { isActive: true } },
      blockedDates: true,
    },
  });
  if (!consultant || consultant.isFlagship) return [];

  const blocked = consultant.blockedDates.some((b) => {
    const bd = new Date(b.date);
    return (
      bd.getUTCFullYear() === dayStart.getUTCFullYear() &&
      bd.getUTCMonth() === dayStart.getUTCMonth() &&
      bd.getUTCDate() === dayStart.getUTCDate()
    );
  });
  if (blocked) return [];

  const avail = consultant.availability.find((a) => a.dayOfWeek === dayOfWeek && a.isActive);
  if (!avail) return [];

  const startM = timeToMinutes(avail.startTime);
  const endM = timeToMinutes(avail.endTime);
  if (endM <= startM || durationMinutes <= 0) return [];

  const slots: string[] = [];
  for (let t = startM; t + durationMinutes <= endM; t += durationMinutes) {
    slots.push(minutesToHHMM(t));
  }

  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const busy = await prisma.consultationBooking.findMany({
    where: {
      consultantId,
      status: { in: [ConsultationStatus.CONFIRMED, ConsultationStatus.PENDING_CONFIRMATION] },
      confirmedDate: { gte: dayStart, lt: dayEnd },
      confirmedTime: { not: null },
    },
    include: { offering: { select: { durationMinutes: true } } },
  });

  function slotOverlapsBooking(slotStartM: number, slotEndM: number, bookingStartM: number, bookingEndM: number): boolean {
    return slotStartM < bookingEndM && slotEndM > bookingStartM;
  }

  const busyRanges = busy
    .map((b) => {
      if (!b.confirmedTime) return null;
      const bm = timeToMinutes(b.confirmedTime);
      const dur = b.offering.durationMinutes;
      return { start: bm, end: bm + dur };
    })
    .filter((x): x is { start: number; end: number } => x !== null);

  const watNowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WAT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const nh = Number(watNowParts.find((p) => p.type === "hour")?.value);
  const nmin = Number(watNowParts.find((p) => p.type === "minute")?.value);
  const nowWatMinutes = nh * 60 + nmin;
  const isToday = dateYmd === getWatYmd();
  const bufferM = 2 * 60;

  return slots.filter((slot) => {
    const sm = timeToMinutes(slot);
    const em = sm + durationMinutes;
    for (const br of busyRanges) {
      if (slotOverlapsBooking(sm, em, br.start, br.end)) return false;
    }
    if (isToday) {
      if (sm < nowWatMinutes + bufferM) return false;
    }
    return true;
  });
}

export async function getNextAvailableDates(
  consultantId: string,
  daysAhead = 60,
  durationMinutes = 60,
): Promise<string[]> {
  const out: string[] = [];
  const startYmd = getWatTomorrowYmd();
  const [sy, sm, sd] = startYmd.split("-").map(Number);
  let cursor = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0, 0));
  const duration = durationMinutes;

  for (let i = 0; i < daysAhead; i++) {
    const ymd = getWatYmd(cursor);
    const slots = await getAvailableSlots(consultantId, ymd, duration);
    if (slots.length > 0) out.push(ymd);
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

export async function formatConsultationFee(
  offering: Pick<ConsultantOffering, "feeNGN" | "feeUSD" | "feeGBP">,
  currency: ShopCurrency,
): Promise<string> {
  const rates = await getExchangeRates();
  if (currency === "NGN") return formatPrice(offering.feeNGN, "NGN");
  if (currency === "USD" && offering.feeUSD != null) return formatPrice(offering.feeUSD, "USD");
  if (currency === "GBP" && offering.feeGBP != null) return formatPrice(offering.feeGBP, "GBP");
  const converted = convertFromNGN(offering.feeNGN, currency, rates);
  return formatPrice(converted, currency);
}

export function getDeliveryModeLabel(mode: ConsultationDeliveryMode): string {
  const labels: Record<ConsultationDeliveryMode, string> = {
    [ConsultationDeliveryMode.VIRTUAL_STANDARD]: "Virtual Video Call",
    [ConsultationDeliveryMode.VIRTUAL_WITH_PRUDENT]: "Virtual with Mrs. Prudent Gabriel-Okopi",
    [ConsultationDeliveryMode.VIRTUAL_WITH_TEAM]: "Virtual with the Design Team",
    [ConsultationDeliveryMode.INPERSON_ATELIER]: "In-Person · Prudential Atelier, Lagos",
    [ConsultationDeliveryMode.INPERSON_ATELIER_PRUDENT]: "In-Person with Mrs. Prudent · Lagos Atelier",
    [ConsultationDeliveryMode.INPERSON_HOME_TEAM]: "Home Visit · Design Team",
    [ConsultationDeliveryMode.INPERSON_HOME_PRUDENT]: "Home Visit · Mrs. Prudent Gabriel-Okopi",
    [ConsultationDeliveryMode.PHONE_CALL]: "Phone / WhatsApp Call",
  };
  return labels[mode];
}

export function getSessionTypeLabel(type: ConsultationSessionType): string {
  const labels: Record<ConsultationSessionType, string> = {
    [ConsultationSessionType.BESPOKE_DESIGN]: "Bespoke Design Session",
    [ConsultationSessionType.BRIDAL_CONSULTATION]: "Bridal Consultation",
    [ConsultationSessionType.STYLING_SESSION]: "Styling & Fabric Session",
    [ConsultationSessionType.WARDROBE_CONSULTATION]: "Wardrobe Consultation",
    [ConsultationSessionType.GROUP_SESSION]: "Group Design Session",
    [ConsultationSessionType.DISCOVERY_CALL]: "Discovery Call",
  };
  return labels[type];
}

export function isVirtualDelivery(mode: ConsultationDeliveryMode): boolean {
  return (
    mode === ConsultationDeliveryMode.VIRTUAL_STANDARD ||
    mode === ConsultationDeliveryMode.VIRTUAL_WITH_PRUDENT ||
    mode === ConsultationDeliveryMode.VIRTUAL_WITH_TEAM
  );
}

export function isHomeVisit(mode: ConsultationDeliveryMode): boolean {
  return mode === ConsultationDeliveryMode.INPERSON_HOME_TEAM || mode === ConsultationDeliveryMode.INPERSON_HOME_PRUDENT;
}

export type ConsultantWithOfferings = Consultant & {
  offerings: ConsultantOffering[];
  availability: { dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }[];
};
