import { Resend } from "resend";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { EMAIL_FROM } from "@/lib/email-transport";
import { getSetting } from "@/lib/settings";
import {
  classifyHttpStatus,
  type EmailError,
  type EmailProvider,
  type OutboundEmail,
} from "@/lib/email-outbox-types";

export type { EmailProvider, OutboundEmail, EmailError };

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
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        });
        if (error) {
          const status = (error as { statusCode?: number }).statusCode ?? 500;
          return { error: classifyHttpStatus(status, error.message) };
        }
        return { id: data?.id ?? "resend-unknown" };
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
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        });
        return { id: String(info.messageId ?? "smtp-unknown") };
      } catch (e) {
        return { error: asError(e) };
      }
    },
  };
}

let testProviders: EmailProvider[] | null = null;

export function setEmailProvidersForTest(providers: EmailProvider[] | null): void {
  testProviders = providers;
}

export async function listEmailProviders(): Promise<EmailProvider[]> {
  if (testProviders) return testProviders;

  const resendKey = await envOrSetting("RESEND_API_KEY", "resend_api_key");
  const smtpPass = await envOrSetting("SMTP_PASSWORD", "smtp_password");
  const smtpUser = (await envOrSetting("SMTP_USER", "smtp_username")) ?? process.env.SMTP_USER;
  const smtpHost = (await envOrSetting("SMTP_HOST", "smtp_host")) ?? process.env.SMTP_HOST;
  const smtpPortRaw = await envOrSetting("SMTP_PORT", "smtp_port");

  const catalog: Record<string, EmailProvider> = {
    resend: createResendProvider({ apiKey: resendKey }),
    smtp: createSmtpProvider({
      host: smtpHost ?? undefined,
      port: smtpPortRaw ? Number(smtpPortRaw) : undefined,
      user: smtpUser ?? undefined,
      pass: smtpPass ?? undefined,
    }),
  };

  const orderRaw = (await getSetting("email_provider_order"))?.trim() || "resend,smtp";
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
