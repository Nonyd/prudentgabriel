/** Explicit budgets for interactive `$transaction(fn)` on client-facing paths. */
export const INTERACTIVE_TX = {
  maxWait: 10_000,
  timeout: 20_000,
} as const;

/** Short allocation helpers (document numbers) when not nested in an outer txn. */
export const SHORT_INTERACTIVE_TX = {
  maxWait: 5_000,
  timeout: 10_000,
} as const;
