import type { PaymentCurrency, PaymentGatewayType } from "@/lib/payments/index";
import { asShopPayCurrency } from "@/lib/atelier-fx";
import { roundToKobo } from "@/lib/money";

export type PayableCurrencyMap = Record<PaymentCurrency, PaymentGatewayType[]>;

const ORDER: PaymentCurrency[] = ["NGN", "USD", "GBP"];

/** Currencies that have at least one live method (gateway or bank). Empty ones are not offered. */
export function currenciesWithMethods(gateways: PayableCurrencyMap): PaymentCurrency[] {
  return ORDER.filter((c) => (gateways[c]?.length ?? 0) > 0);
}

/**
 * If the invoice is in pounds but only naira can collect, default to naira.
 * Never default to a currency with no method.
 */
export function defaultPayCurrency(
  invoiceCurrency: string,
  available: PaymentCurrency[],
): PaymentCurrency | null {
  if (available.length === 0) return null;
  const preferred = asShopPayCurrency(invoiceCurrency);
  if (available.includes(preferred)) return preferred;
  if (available.includes("NGN")) return "NGN";
  return available[0] ?? null;
}

export type InvoicePayFigures = {
  remainingDepositNGN: number;
  remainingBalanceNGN: number;
  showDeposit: boolean;
  depositNGN: number;
  balanceNGN: number;
};

export function invoicePayFigures(params: {
  remainingDepositNGN: number;
  remainingBalanceNGN: number;
}): InvoicePayFigures {
  const remainingDepositNGN = roundToKobo(Math.max(0, params.remainingDepositNGN));
  const remainingBalanceNGN = roundToKobo(Math.max(0, params.remainingBalanceNGN));
  const showDeposit = remainingDepositNGN > 0.01 && remainingDepositNGN + 0.009 < remainingBalanceNGN;
  return {
    remainingDepositNGN,
    remainingBalanceNGN,
    showDeposit,
    depositNGN: remainingDepositNGN,
    balanceNGN: remainingBalanceNGN,
  };
}

/** Amount charged for a radio, independent of which radio is selected. */
export function amountForPayOption(
  option: "deposit" | "full",
  figures: InvoicePayFigures,
): number {
  if (option === "deposit" && figures.showDeposit) return figures.depositNGN;
  return figures.balanceNGN;
}
