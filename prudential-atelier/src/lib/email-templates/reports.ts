import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";

/**
 * Building blocks for the staff reports (daily, weekly). Email-safe HTML:
 * tables and inline styles only, 600px wide, readable on a phone.
 * Every value passed in as text is escaped here; `Html` values are trusted markup built by these helpers.
 */

const C = {
  page: "#F0E8DD",
  card: "#FFFDF9",
  ink: "#2B1A10",
  choc: "#442913",
  muted: "#7A6353",
  line: "#E4D6C8",
  tint: "#F7F0E7",
  gold: "#B0874A",
  good: "#2F6B42",
  bad: "#9A3324",
  warnBg: "#FBF1E2",
  warnLine: "#E3C18F",
  okBg: "#EEF5EF",
};
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Jost,'Helvetica Neue',Arial,sans-serif";

export type Html = { __html: string };
const html = (s: string): Html => ({ __html: s });

export function esc(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function naira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

/** ₦1.25M, ₦850k, ₦12,500. For subject lines and tiles. */
export function nairaShort(n: number): string {
  const v = Math.round(n);
  if (Math.abs(v) >= 1_000_000) return `₦${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 2).replace(/\.?0+$/, "")}M`;
  if (Math.abs(v) >= 100_000) return `₦${Math.round(v / 1000)}k`;
  return naira(v);
}

/** "+12% on the day before", coloured. Null when there is nothing to compare. */
export function change(now: number, before: number, against: string): Html | null {
  if (before <= 0 && now <= 0) return null;
  if (before <= 0) return html(`<span style="color:${C.good};">New this period</span> <span style="color:${C.muted};">· nothing ${esc(against)}</span>`);
  const pct = Math.round(((now - before) / before) * 100);
  const colour = pct > 0 ? C.good : pct < 0 ? C.bad : C.muted;
  const sign = pct > 0 ? "+" : "";
  return html(`<span style="color:${colour};font-weight:600;">${sign}${pct}%</span> <span style="color:${C.muted};">${esc(against)}</span>`);
}

export type Tile = { label: string; value: string; note?: Html | string | null };

export function tiles(items: Tile[]): Html {
  const cell = (t: Tile | undefined, side: "l" | "r") =>
    t
      ? `<td width="50%" valign="top" style="padding:${side === "l" ? "0 6px 12px 0" : "0 0 12px 6px"};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line};">
            <tr><td style="padding:16px 18px;">
              <div style="font-family:${SANS};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${C.muted};">${esc(t.label)}</div>
              <div style="font-family:${SERIF};font-size:28px;line-height:1.15;color:${C.choc};padding-top:6px;">${esc(t.value)}</div>
              ${t.note ? `<div style="font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};padding-top:6px;">${typeof t.note === "string" ? esc(t.note) : t.note.__html}</div>` : ""}
            </td></tr>
          </table>
        </td>`
      : `<td width="50%"></td>`;
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(`<tr>${cell(items[i], "l")}${cell(items[i + 1], "r")}</tr>`);
  return html(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">${rows.join("")}</table>`);
}

export type AttentionItem = { label: string; detail: string; href: string };

export function attention(items: AttentionItem[], appUrl: string): Html {
  if (items.length === 0) {
    return html(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.okBg};border:1px solid #CFE3D3;">
      <tr><td style="padding:14px 18px;font-family:${SANS};font-size:14px;color:${C.good};"><strong>All clear.</strong> Nothing is waiting on the team.</td></tr>
    </table>`);
  }
  const rows = items
    .map(
      (a, i) => `<tr><td style="padding:12px 18px;${i ? `border-top:1px solid ${C.warnLine};` : ""}font-family:${SANS};font-size:14px;line-height:1.5;color:${C.ink};">
        <a href="${esc(appUrl + a.href)}" style="color:${C.choc};font-weight:600;text-decoration:none;">${esc(a.label)} →</a><br/>
        <span style="color:${C.muted};font-size:13px;">${esc(a.detail)}</span>
      </td></tr>`,
    )
    .join("");
  return html(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.warnBg};border:1px solid ${C.warnLine};">${rows}</table>`);
}

/** Simple table. First column left, the rest right-aligned when `numeric`. */
export function table(head: string[], rows: (string | Html)[][], opts: { numericFrom?: number } = {}): Html {
  const n = opts.numericFrom ?? head.length;
  const th = head
    .map(
      (h, i) =>
        `<th align="${i >= n ? "right" : "left"}" style="padding:8px 10px;border-bottom:1px solid ${C.line};font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${C.muted};">${esc(h)}</th>`,
    )
    .join("");
  const tr = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (c, i) =>
              `<td align="${i >= n ? "right" : "left"}" valign="top" style="${i === 0 ? "white-space:nowrap;" : ""}padding:9px 10px;border-bottom:1px solid ${C.line};font-family:${SANS};font-size:14px;line-height:1.45;color:${C.ink};">${typeof c === "string" ? esc(c) : c.__html}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return html(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${C.card};border:1px solid ${C.line};"><tr>${th}</tr>${tr}</table>`);
}

/** Horizontal share bars, e.g. takings by line. */
export function shareBars(items: { label: string; value: number; display: string }[]): Html {
  const max = Math.max(1, ...items.map((i) => i.value));
  const rows = items
    .map((i) => {
      const w = Math.max(i.value > 0 ? 2 : 0, Math.round((i.value / max) * 100));
      return `<tr>
        <td width="34%" style="padding:6px 10px 6px 0;font-family:${SANS};font-size:13px;color:${C.ink};">${esc(i.label)}</td>
        <td style="padding:6px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${w > 0 ? `<td width="${w}%" style="background:${C.gold};height:12px;font-size:0;line-height:0;">&nbsp;</td>` : ""}
            <td style="background:${C.tint};height:12px;font-size:0;line-height:0;">&nbsp;</td>
          </tr></table>
        </td>
        <td width="22%" align="right" style="padding:6px 0 6px 10px;font-family:${SANS};font-size:13px;color:${C.ink};white-space:nowrap;">${esc(i.display)}</td>
      </tr>`;
    })
    .join("");
  return html(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`);
}

/** Seven columns of daily takings. Heights scale to the best day. */
export function dayColumns(days: { label: string; value: number }[]): Html {
  const max = Math.max(1, ...days.map((d) => d.value));
  const BAR = 90;
  const cols = days
    .map((d) => {
      const h = d.value > 0 ? Math.max(3, Math.round((d.value / max) * BAR)) : 0;
      return `<td align="center" valign="bottom" width="${Math.floor(100 / days.length)}%" style="padding:0 4px;">
        <div style="font-family:${SANS};font-size:10px;color:${C.muted};padding-bottom:4px;white-space:nowrap;">${d.value > 0 ? esc(nairaShort(d.value)) : "—"}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:${BAR - h}px;font-size:0;line-height:0;">&nbsp;</td></tr>
        ${h > 0 ? `<tr><td style="height:${h}px;background:${C.gold};font-size:0;line-height:0;">&nbsp;</td></tr>` : ""}</table>
        <div style="font-family:${SANS};font-size:11px;color:${C.ink};padding-top:6px;border-top:1px solid ${C.line};">${esc(d.label)}</div>
      </td>`;
    })
    .join("");
  return html(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line};padding:14px 8px 10px;"><tr>${cols}</tr></table>`);
}

export function paragraph(text: string, muted = false): Html {
  return html(`<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${muted ? C.muted : C.ink};">${esc(text)}</p>`);
}

export function join(...parts: (Html | null | false | undefined)[]): Html {
  return html(parts.filter((p): p is Html => Boolean(p)).map((p) => p.__html).join(`<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>`));
}

export function raw(markup: string): Html {
  return html(markup);
}

export type ReportSection = { heading: string; body: Html; note?: string };

export function reportEmail(p: {
  kind: string;
  title: string;
  subtitle: string;
  preheader: string;
  sections: ReportSection[];
  quiet?: string[];
  appUrl: string;
  ctaHref: string;
  ctaLabel: string;
  footer: string;
}): string {
  const sections = p.sections
    .map(
      (s) => `<tr><td style="padding:26px 28px 0;">
        <div style="font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${C.gold};padding-bottom:10px;">${esc(s.heading)}</div>
        ${s.body.__html}
        ${s.note ? `<div style="font-family:${SANS};font-size:12px;color:${C.muted};padding-top:8px;">${esc(s.note)}</div>` : ""}
      </td></tr>`,
    )
    .join("");
  const quiet = p.quiet?.length
    ? `<tr><td style="padding:22px 28px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted};">Nothing recorded for: ${esc(p.quiet.join(", "))}.</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)}</title></head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page};">${esc(p.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.line};">
      <tr><td style="background:${C.choc};padding:26px 28px;">
        <div style="font-family:${SANS};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#D9C2A6;">${esc(CUSTOMER_HOUSE_NAME)} · ${esc(p.kind)}</div>
        <div style="font-family:${SERIF};font-size:30px;line-height:1.2;color:#FBF5EC;padding-top:8px;">${esc(p.title)}</div>
        <div style="font-family:${SANS};font-size:13px;color:#D9C2A6;padding-top:6px;">${esc(p.subtitle)}</div>
      </td></tr>
      ${sections}
      ${quiet}
      <tr><td style="padding:28px;">
        <a href="${esc(p.appUrl + p.ctaHref)}" style="display:inline-block;background:${C.choc};color:#FBF5EC;padding:13px 26px;text-decoration:none;font-family:${SANS};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">${esc(p.ctaLabel)}</a>
      </td></tr>
      <tr><td style="padding:16px 28px 22px;border-top:1px solid ${C.line};font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">${esc(p.footer)}</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Body only; the sender wraps it in the atelier layout. */
export function eventReminderEmailBody(params: {
  firstName: string;
  eventLabel: string;
  weeksAway: number;
  appUrl: string;
}) {
  const body = `
    <p style="font-size:14px;line-height:1.6;color:#5C3422;">
      Hi ${params.firstName}, your <strong>${params.eventLabel}</strong> is about ${params.weeksAway} week${params.weeksAway !== 1 ? "s" : ""} away.
      Whether you need an atelier commission or something from our collection, we'd love to dress you for the occasion.
    </p>`;
  return `
    <h1 style="margin:0 0 24px;font-family:Georgia,serif;font-size:24px;font-weight:normal;color:#442913;">${params.eventLabel} is coming up</h1>
    ${body}
    <p style="margin-top:28px;"><a href="${params.appUrl}/consultation" style="display:inline-block;background:#5C3422;color:#E2D1C2;padding:12px 24px;text-decoration:none;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;">Book a Consultation</a></p>`;
}
