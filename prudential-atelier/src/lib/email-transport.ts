import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const smtpOptions: SMTPTransport.Options = {
  host: process.env.SMTP_HOST ?? "mail.prudentgabriel.com",
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER ?? "noreply@prudentgabriel.com",
    pass: process.env.SMTP_PASSWORD ?? "",
  },
};

export const transporter = nodemailer.createTransport(smtpOptions);

export const EMAIL_FROM = '"Prudential Atelier" <noreply@prudentgabriel.com>';
export const ORDERS_EMAIL = "orders@prudentgabriel.com";
export const FINANCE_EMAIL = "finance@prudentgabriel.com";

export async function sendSmtpMail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}): Promise<void> {
  if (!process.env.SMTP_PASSWORD) {
    console.log("[SMTP]", params.to, params.subject, params.attachments?.length ? `(${params.attachments.length} attachment(s))` : "");
    return;
  }

  await transporter.sendMail({
    from: params.from ?? EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments,
  });
}
