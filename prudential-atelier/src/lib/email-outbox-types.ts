export type EmailErrorKind = "retryable" | "terminal" | "auth";

export type EmailError = {
  kind: EmailErrorKind;
  message: string;
  status?: number;
};

export type OutboundEmail = {
  to: string;
  cc?: string;
  bcc?: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
};

export interface EmailProvider {
  name: string;
  send(msg: OutboundEmail): Promise<{ id: string } | { error: EmailError }>;
  isConfigured(): boolean;
}

export function classifyHttpStatus(status: number, message: string): EmailError {
  if (status === 401 || status === 403) {
    return { kind: "auth", message, status };
  }
  if (status === 429 || status >= 500 || status === 408) {
    return { kind: "retryable", message, status };
  }
  if (status >= 400 && status < 500) {
    return { kind: "terminal", message, status };
  }
  return { kind: "retryable", message, status };
}

/** 1m, 5m, 30m, 2h, 12h */
export const BACKOFF_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
] as const;

export function nextBackoffMs(attempts: number): number {
  const idx = Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1;
  return BACKOFF_MS[idx];
}
