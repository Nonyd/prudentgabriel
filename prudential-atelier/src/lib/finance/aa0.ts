/** Slice AA — what the numbers mean. Shown on both finance pages. */

export const FINANCE_TZ = "Africa/Lagos";

export const CASH_BASIS_TITLE = "Cash basis";

export const CASH_BASIS_COPY =
  "A sale is recognised when the payment is confirmed — when the money lands or a transfer is ticked in — not when the garment is cut. An atelier deposit is cash received for work still ahead. It is Atelier cash, labelled Deposit, not a finished commission.";

export const VAT_TITLE = "VAT";

export const VAT_COPY =
  "Shop prices do not include VAT and VAT is not added at checkout. Atelier invoices may add VAT on top of the lines (exclusive). The house default is 0%. Nigeria's rate is 7.5% when an invoice turns VAT on. Where VAT applies it is broken out on every line and in the totals.";

export const CURRENCY_TITLE = "Reporting currency";

export const CURRENCY_COPY =
  "Figures are naira. A dollar or pound order keeps the rate locked at checkout; the original amount and currency sit beside the naira. Nothing is converted quietly.";

export const ACCESS_TITLE = "Who can open this";

export const ACCESS_COPY =
  "Finance Manager reaches reports and bank accounts. They do not get the rest of Settings.";

export const AA0_LINES = [
  { title: CASH_BASIS_TITLE, body: CASH_BASIS_COPY },
  { title: VAT_TITLE, body: VAT_COPY },
  { title: CURRENCY_TITLE, body: CURRENCY_COPY },
  { title: ACCESS_TITLE, body: ACCESS_COPY },
] as const;
