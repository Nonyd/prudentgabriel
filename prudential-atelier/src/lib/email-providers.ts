import { Resend } from "resend";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { EMAIL_FROM } from "@/lib/email-transport";
import { getSetting } from "@/lib/settings";
import {
  classifyBrevoError,
  classifyHttpStatus,
  classifyResendError,
  type EmailAttachment,
  type EmailError,
  type EmailProvider,
  type OutboundEmail,
} from "@/lib/email-outbox-types";

export type { EmailProvider, OutboundEmail, EmailError, EmailAttachment };

async function envOrSetting(envKey: string, settingKey: string): Promise<string | null> {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  const fromDb = (await getSetting(settingKey))?.trim();
  return fromDb || null;
}

export async function resolveFromAddress(): Promise<string> {
  const name = (await getSetting("email_from_name"))?.trim() || "Prudential Atelier";
  const addr = (await getSetting("email_from_address"))?.trim();
  if (addr) return `"${name}" <${addr}>`;
  return EMAIL_FROM;
}

export async function resolveReplyTo(): Promise<string | undefined> {
  const addr = (await getSetting("email_reply_to"))?.trim();
  return addr || undefined;
}

/** Domains allowed in From (anti-spoof). Override with EMAIL_ALLOWED_FROM_DOMAINS=a.com,b.com */
export function allowedFromDomains(): string[] {
  const raw = process.env.EMAIL_ALLOWED_FROM_DOMAINS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return ["prudentgabriel.com"];
}

export function extractEmailAddress(from: string): string | null {
  const m = from.match(/<([^>]+)>/);
  const addr = (m?.[1] ?? from).trim().toLowerCase();
  return addr.includes("@") ? addr : null;
}

/** True when From uses an allowlisted brand domain (not a free Gmail/clone domain). */
export function isAllowedFromAddress(from: string, domains = allowedFromDomains()): boolean {
  const addr = extractEmailAddress(from);
  if (!addr) return false;
  const host = addr.split("@")[1] ?? "";
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Force From onto the configured brand address when a caller (or stale DB row)
 * tries to send as an external/cloned domain.
 */
export async function sanitizeFromAddress(from: string | null | undefined): Promise<string> {
  const candidate = from?.trim();
  if (candidate && isAllowedFromAddress(candidate)) return candidate;
  return resolveFromAddress().catch(() => EMAIL_FROM);
}

function asError(err: unknown): EmailError {
  const message = err instanceof Error ? err.message : String(err);
  const any = err as { statusCode?: number; responseCode?: number; code?: string };
  const status = any.statusCode ?? any.responseCode;
  if (typeof status === "number") return classifyHttpStatus(status, message);
  if (any.code === "EAUTH") return { kind: "auth", message };
  if (
    any.code === "ECONNRESET" ||
    any.code === "ETIMEDOUT" ||
    any.code === "ECONNREFUSED" ||
    any.code === "ESOCKET" ||
    any.code === "EENVELOPE"
  ) {
    return { kind: "retryable", message };
  }
  if (message.toLowerCase().includes("invalid") && message.toLowerCase().includes("recipient")) {
    return { kind: "terminal", message };
  }
  return { kind: "retryable", message };
}

function parseAddressList(raw: string): Array<{ email: string; name?: string }> {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$|^([^\s<>]+@[^\s<>]+)$/);
      if (!m) return { email: part };
      if (m[3]) return { email: m[3] };
      const name = m[1]?.trim();
      return name ? { email: m[2]!, name } : { email: m[2]! };
    });
}

function parseFrom(from: string): { email: string; name?: string } {
  const [first] = parseAddressList(from);
  return first ?? { email: from };
}

function normalizeAttachments(raw: unknown): EmailAttachment[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: EmailAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const filename =
      (typeof rec.filename === "string" && rec.filename) ||
      (typeof rec.name === "string" && rec.name) ||
      "";
    const content =
      (typeof rec.content === "string" && rec.content) ||
      (typeof rec.contentBase64 === "string" && rec.contentBase64) ||
      "";
    if (!filename || !content) continue;
    out.push({
      filename,
      content: content.replace(/^data:[^;]+;base64,/, ""),
      contentType: typeof rec.contentType === "string" ? rec.contentType : undefined,
    });
  }
  return out.length ? out : undefined;
}

export function createResendProvider(opts?: { apiKey?: string | null }): EmailProvider {
  const key = () => opts?.apiKey ?? process.env.RESEND_API_KEY?.trim() ?? "";
  return {
    name: "resend",
    isConfigured() {
      return Boolean(key());
    },
    async send(msg) {
      const apiKey = key();
      if (!apiKey) return { error: { kind: "auth", message: "Resend API key not configured" } };
      try {
        const resend = new Resend(apiKey);
        const { data, error } = await resend.emails.send({
          from: msg.from,
          to: msg.to,
          cc: msg.cc,
          bcc: msg.bcc,
          replyTo: msg.replyTo,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          headers: msg.headers,
          attachments: msg.attachments?.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content, "base64"),
            contentType: a.contentType,
          })),
        });
        if (error) {
          const status = (error as { statusCode?: number }).statusCode ?? 500;
          return { error: classifyResendError(status, error.message) };
        }
        return { id: data?.id ?? "resend-unknown" };
      } catch (e) {
        return { error: asError(e) };
      }
    },
  };
}

export function createBrevoProvider(opts?: { apiKey?: string | null }): EmailProvider {
  const key = () =>
    opts?.apiKey ?? process.env.BREVO_API_KEY?.trim() ?? process.env.SIB_API_KEY?.trim() ?? "";
  return {
    name: "brevo",
    isConfigured() {
      return Boolean(key());
    },
    async send(msg) {
      const apiKey = key();
      if (!apiKey) return { error: { kind: "auth", message: "Brevo API key not configured" } };
      try {
        const sender = parseFrom(msg.from);
        const body: Record<string, unknown> = {
          sender,
          to: parseAddressList(msg.to),
          subject: msg.subject,
          htmlContent: msg.html,
        };
        if (msg.text) body.textContent = msg.text;
        if (msg.cc) body.cc = parseAddressList(msg.cc);
        if (msg.bcc) body.bcc = parseAddressList(msg.bcc);
        if (msg.replyTo) {
          const reply = parseFrom(msg.replyTo);
          body.replyTo = reply;
        }
        if (msg.attachments?.length) {
          body.attachment = msg.attachments.map((a) => ({
            name: a.filename,
            content: a.content,
          }));
        }
        if (msg.headers && Object.keys(msg.headers).length > 0) {
          body.headers = msg.headers;
        }

        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify(body),
        });
        const payload = (await res.json().catch(() => null)) as
          | { messageId?: string; message?: string; code?: string }
          | null;
        if (!res.ok) {
          return {
            error: classifyBrevoError(res.status, payload?.message || `Brevo HTTP ${res.status}`, payload?.code),
          };
        }
        return { id: payload?.messageId ?? "brevo-unknown" };
      } catch (e) {
        return { error: asError(e) };
      }
    },
  };
}

export function createSmtpProvider(opts?: {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
}): EmailProvider {
  const pass = () => opts?.pass ?? process.env.SMTP_PASSWORD?.trim() ?? "";
  return {
    name: "smtp",
    isConfigured() {
      return Boolean(pass());
    },
    async send(msg) {
      const password = pass();
      if (!password) return { error: { kind: "auth", message: "SMTP password not configured" } };
      try {
        const transport = nodemailer.createTransport({
          host: opts?.host ?? process.env.SMTP_HOST ?? "mail.prudentgabriel.com",
          port: opts?.port ?? Number(process.env.SMTP_PORT ?? 465),
          secure: (opts?.port ?? Number(process.env.SMTP_PORT ?? 465)) === 465,
          auth: {
            user: opts?.user ?? process.env.SMTP_USER ?? "noreply@prudentgabriel.com",
            pass: password,
          },
        } satisfies SMTPTransport.Options);
        const info = await transport.sendMail({
          from: msg.from,
          to: msg.to,
          cc: msg.cc,
          bcc: msg.bcc,
          replyTo: msg.replyTo,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          headers: msg.headers,
          attachments: msg.attachments?.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content, "base64"),
            contentType: a.contentType,
          })),
        });
        return { id: String(info.messageId ?? "smtp-unknown") };
      } catch (e) {
        return { error: asError(e) };
      }
    },
  };
}

export { normalizeAttachments };

let testProviders: EmailProvider[] | null = null;

export function setEmailProvidersForTest(providers: EmailProvider[] | null): void {
  testProviders = providers;
}

export async function listEmailProviders(): Promise<EmailProvider[]> {
  if (testProviders) return testProviders;

  const resendKey = await envOrSetting("RESEND_API_KEY", "resend_api_key");
  const brevoKey = await envOrSetting("BREVO_API_KEY", "brevo_api_key");
  const smtpPass = await envOrSetting("SMTP_PASSWORD", "smtp_password");
  const smtpUser = (await envOrSetting("SMTP_USER", "smtp_username")) ?? process.env.SMTP_USER;
  const smtpHost = (await envOrSetting("SMTP_HOST", "smtp_host")) ?? process.env.SMTP_HOST;
  const smtpPortRaw = await envOrSetting("SMTP_PORT", "smtp_port");

  const catalog: Record<string, EmailProvider> = {
    resend: createResendProvider({ apiKey: resendKey }),
    brevo: createBrevoProvider({ apiKey: brevoKey }),
    smtp: createSmtpProvider({
      host: smtpHost ?? undefined,
      port: smtpPortRaw ? Number(smtpPortRaw) : undefined,
      user: smtpUser ?? undefined,
      pass: smtpPass ?? undefined,
    }),
  };

  const orderRaw = (await getSetting("email_provider_order"))?.trim() || "resend,brevo,smtp";
  const names = orderRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const ordered: EmailProvider[] = [];
  for (const name of names) {
    const p = catalog[name];
    if (p && !ordered.some((x) => x.name === p.name)) ordered.push(p);
  }
  for (const p of Object.values(catalog)) {
    if (!ordered.some((x) => x.name === p.name)) ordered.push(p);
  }
  return ordered.filter((p) => p.isConfigured());
}
