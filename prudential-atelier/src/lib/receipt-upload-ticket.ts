import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 30 * 60 * 1000;

function secret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

export function signReceiptUploadTicket(email: string): { ticket: string; exp: number } {
  const exp = Date.now() + TTL_MS;
  const payload = `${email.toLowerCase()}:${exp}`;
  const ticket = createHmac("sha256", secret()).update(payload).digest("hex");
  return { ticket, exp };
}

export function verifyReceiptUploadTicket(email: string, ticket: string, exp: number): boolean {
  if (!secret() || !ticket || !exp) return false;
  if (Date.now() > exp) return false;
  const payload = `${email.toLowerCase()}:${exp}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(ticket, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
