export type EmailErrorKind = "retryable" | "terminal" | "auth";

export type EmailError = {
  kind: EmailErrorKind;
  message: string;
  status?: number;
  /** Raise an admin notification without changing retry/failover semantics. */
  alert?: "provider_config";
};

export type EmailAttachment = {
  filename: string;
  /** Base64-encoded file bytes. */
  content: string;
  contentType?: string;
};

export type OutboundEmail = {
  to: string;
  cc?: string;
  bcc?: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
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

/** Resend free-tier / rate-limit exhaustion must fail over, not DEAD the message. */
export function classifyResendError(status: number, message: string): EmailError {
  const msg = message || `Resend HTTP ${status}`;
  const msgLower = msg.toLowerCase();
  const quota =
    status === 402 ||
    status === 429 ||
    msgLower.includes("rate limit") ||
    msgLower.includes("too many requests") ||
    msgLower.includes("daily quota") ||
    msgLower.includes("monthly quota") ||
    msgLower.includes("quota exceeded") ||
    msgLower.includes("usage limit") ||
    msgLower.includes("out of credits");

  if (quota) {
    return { kind: "retryable", message: msg, status: status || 429 };
  }
  return classifyHttpStatus(status, msg);
}

/**
 * Brevo-specific mapping. Do not use status alone — `402` and some `400`s are
 * config/quota, not bad message content.
 */
export function classifyBrevoError(
  status: number,
  message: string,
  code?: string | null,
): EmailError {
  const msg = message || `Brevo HTTP ${status}`;
  const codeNorm = (code ?? "").toLowerCase();
  const msgLower = msg.toLowerCase();

  if (status === 401 || status === 403 || codeNorm === "unauthorized") {
    return { kind: "auth", message: msg, status };
  }

  if (
    status === 402 ||
    codeNorm === "not_enough_credits" ||
    msgLower.includes("not_enough_credits") ||
    msgLower.includes("not enough credits") ||
    msgLower.includes("insufficient credits")
  ) {
    return { kind: "retryable", message: msg, status: status || 402 };
  }

  if (status === 429) {
    return { kind: "retryable", message: msg, status };
  }

  if (status >= 500 || status === 408) {
    return { kind: "retryable", message: msg, status };
  }

  const unverifiedSender =
    msgLower.includes("unverified") ||
    msgLower.includes("sender is not valid") ||
    msgLower.includes("sender not valid") ||
    msgLower.includes("invalid sender") ||
    (msgLower.includes("sender") &&
      (msgLower.includes("not verified") ||
        msgLower.includes("authenticate") ||
        msgLower.includes("validate your sender")));

  if (status === 400 && unverifiedSender) {
    return {
      kind: "terminal",
      message: msg,
      status,
      alert: "provider_config",
    };
  }

  if (status >= 400 && status < 500) {
    return { kind: "terminal", message: msg, status };
  }

  return { kind: "retryable", message: msg, status };
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
