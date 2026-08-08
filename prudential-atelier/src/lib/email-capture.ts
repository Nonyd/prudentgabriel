/**
 * Script/E2E hook: when E2E_CAPTURE_EMAIL=1, record every sendEmail payload
 * instead of (or in addition to) real transport. Used by e2e-quote-convert
 * so JSX render + dispatch can be asserted without SMTP.
 */

export type CapturedEmail = {
  to: string;
  subject: string;
  html: string;
  at: Date;
};

const buffer: CapturedEmail[] = [];

export function isEmailCaptureEnabled(): boolean {
  return process.env.E2E_CAPTURE_EMAIL === "1" || process.env.E2E_CAPTURE_EMAIL === "true";
}

export function clearCapturedEmails(): void {
  buffer.length = 0;
}

export function getCapturedEmails(): CapturedEmail[] {
  return [...buffer];
}

export function recordCapturedEmail(params: { to: string; subject: string; html: string }): void {
  buffer.push({ ...params, at: new Date() });
}
