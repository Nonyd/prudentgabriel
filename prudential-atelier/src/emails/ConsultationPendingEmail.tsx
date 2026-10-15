import { Section, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailLayout from "./components/EmailLayout";
import { EMAIL_CHOC, EMAIL_GOLD, EMAIL_INK, EMAIL_MUTED, FONT_BODY, FONT_DISPLAY } from "./components/email-tokens";
import { consultationLetter, consultationPrepPoints } from "@/lib/consultation-prep-copy";

const APP = getPublicAppUrl();

/** Sent once the consultation fee is paid (online, or a bank transfer the admin confirmed). */
export type ConsultationPendingEmailProps = {
  firstName: string;
  bookingNumber: string;
  isVirtual: boolean;
  durationMinutes: number;
  preferredDate1?: string;
  preferredDate2?: string;
  preferredDate3?: string;
  /** Admin-editable opening and closing (catalog body 1 / body 2); defaults to the standard copy. */
  intro?: string;
  closing?: string;
};

function fmt(d?: string): string {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Africa/Lagos" }).format(new Date(d));
  } catch {
    return d;
  }
}

function paragraphs(text: string | undefined, fallback: string[]): string[] {
  const lines = text?.split(/\n{2,}/).map((l) => l.trim()).filter(Boolean);
  return lines?.length ? lines : fallback;
}

const p = { margin: "0 0 16px", fontSize: 15, lineHeight: 1.75, color: EMAIL_INK, fontFamily: FONT_BODY };

export default function ConsultationPendingEmail({
  firstName,
  bookingNumber,
  isVirtual,
  durationMinutes,
  preferredDate1,
  preferredDate2,
  preferredDate3,
  intro,
  closing,
}: ConsultationPendingEmailProps) {
  const points = consultationPrepPoints({ isVirtual, durationMinutes });
  const letter = consultationLetter(isVirtual);
  const dates = [preferredDate1, preferredDate2, preferredDate3].filter(Boolean).map(fmt);

  return (
    <EmailLayout family="relationship" previewText="Thank you for choosing Prudent Gabriel — we cannot wait to meet you">
      <Text style={{ ...p, fontSize: 17 }}>Dear {firstName},</Text>
      {paragraphs(intro, letter.intro).map((line) => (
        <Text key={line} style={p}>
          {line}
        </Text>
      ))}

      <Text style={{ ...p, margin: "8px 0 12px" }}>
        {letter.lead}
      </Text>
      {points.map((point, i) => (
        <Section key={point.title} style={{ margin: "0 0 14px" }}>
          <Text
            style={{
              margin: "0 0 4px",
              fontFamily: FONT_DISPLAY,
              fontSize: 18,
              color: EMAIL_CHOC,
              lineHeight: 1.3,
            }}
          >
            {i + 1}. {point.title}
          </Text>
          <Text style={{ ...p, margin: 0 }}>{point.body}</Text>
        </Section>
      ))}

      <Section
        style={{ margin: "24px 0", padding: "16px 20px", borderLeft: `3px solid ${EMAIL_GOLD}`, backgroundColor: "#F7F2EC" }}
      >
        <Text style={{ margin: 0, fontSize: 13, color: EMAIL_MUTED, fontFamily: FONT_BODY }}>
          Booking #{bookingNumber}
        </Text>
        {dates.length ? (
          <Text style={{ margin: "6px 0 0", fontSize: 14, color: EMAIL_INK, lineHeight: 1.7, fontFamily: FONT_BODY }}>
            Your proposed dates: {dates.join(" · ")}. We will confirm one with you within 24–48 hours.
          </Text>
        ) : null}
        {isVirtual ? (
          <Text style={{ margin: "6px 0 0", fontSize: 14, color: EMAIL_INK, lineHeight: 1.7, fontFamily: FONT_BODY }}>
            Your Zoom or Google Meet link will reach you by email before the session.
          </Text>
        ) : null}
      </Section>

      {paragraphs(closing, letter.closing).map((line) => (
        <Text key={line} style={p}>
          {line}
        </Text>
      ))}
      <EmailButton href={`${APP}/consultation/${encodeURIComponent(bookingNumber)}`}>View your booking</EmailButton>
    </EmailLayout>
  );
}
