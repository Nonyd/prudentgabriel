import { classifyPayments, money, type ClassifiedLine } from "@/lib/finance/classify";
import { linesInRange, loadFinanceSnaps } from "@/lib/finance/query";

/**
 * Money taken in a period: payments confirmed in it, read from the append-only
 * Payment ledger through the same classification as the finance pages (Slice AA).
 *
 * Not a commission's cached amountPaid, and never "commissions touched in the
 * period": a gown paid in August that gets a note today adds nothing to today.
 * Every revenue figure outside the finance pages (daily and weekly reports,
 * the dashboard and its chart) reads this.
 */
export type Takings = {
  totalNGN: number;
  rtwNGN: number;
  /** Atelier, consultations included. */
  atelierNGN: number;
  consultationNGN: number;
  /** Atelier less consultations: deposits and balances on garments. */
  commissionNGN: number;
};

/** Pure: sum confirmed cash by line. */
export function sumTakings(lines: Pick<ClassifiedLine, "cashNGN" | "businessLine" | "atelierKind">[]): Takings {
  const t: Takings = { totalNGN: 0, rtwNGN: 0, atelierNGN: 0, consultationNGN: 0, commissionNGN: 0 };
  for (const l of lines) {
    if (l.cashNGN <= 0) continue;
    t.totalNGN += l.cashNGN;
    if (l.businessLine === "RTW") t.rtwNGN += l.cashNGN;
    if (l.businessLine === "ATELIER") {
      t.atelierNGN += l.cashNGN;
      if (l.atelierKind === "consultation") t.consultationNGN += l.cashNGN;
      else t.commissionNGN += l.cashNGN;
    }
  }
  return {
    totalNGN: money(t.totalNGN),
    rtwNGN: money(t.rtwNGN),
    atelierNGN: money(t.atelierNGN),
    consultationNGN: money(t.consultationNGN),
    commissionNGN: money(t.commissionNGN),
  };
}

/** The ledger lines recognised in [from, to): load once, bucket as often as needed. */
export async function ledgerLines(from: Date, to: Date): Promise<ClassifiedLine[]> {
  return linesInRange(classifyPayments(await loadFinanceSnaps(from, to)), from, to);
}

export function takingsIn(lines: ClassifiedLine[], from: Date, to: Date): Takings {
  return sumTakings(linesInRange(lines, from, to));
}

export async function takings(from: Date, to: Date): Promise<Takings> {
  return sumTakings(await ledgerLines(from, to));
}
