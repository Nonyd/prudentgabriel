import type { ApplicationStatus } from "@prisma/client";
import { Heading, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import { EMAIL_CHOC, EMAIL_INK, EMAIL_MUTED, FONT_BODY } from "./components/email-tokens";

const STATUS_COPY: Record<
  ApplicationStatus,
  { subject: string; headline: string; body: string } | null
> = {
  NEW: null,
  REVIEWED: null,
  SHORTLISTED: {
    subject: "You've been shortlisted",
    headline: "Congratulations — you've been shortlisted",
    body: "Your application stood out to us. Our team will be in touch shortly with next steps.",
  },
  INTERVIEWED: {
    subject: "Interview invitation",
    headline: "We'd like to meet you",
    body: "Thank you for your interest in joining Prudential Atelier. We would like to invite you for an interview. Our team will follow up with scheduling details.",
  },
  REJECTED: {
    subject: "Thank you for applying",
    headline: "Thank you for your application",
    body: "We appreciate the time you took to apply. After careful review, we will not be moving forward at this time. We wish you every success in your career.",
  },
  HIRED: {
    subject: "Welcome to Prudential Atelier",
    headline: "Welcome to the house",
    body: "We are delighted to offer you a place on our team. Our HR team will reach out with onboarding details.",
  },
};

export function jobStatusEmailCopy(status: ApplicationStatus) {
  return STATUS_COPY[status];
}

export function JobApplicationStatusEmail({
  name,
  jobTitle,
  status,
}: {
  name: string;
  jobTitle: string;
  status: ApplicationStatus;
}) {
  const copy = STATUS_COPY[status];
  if (!copy) return null;

  return (
    <EmailLayout family="relationship" previewText={`${copy.subject} — ${jobTitle}`}>
      <Heading
        as="h1"
        style={{ color: EMAIL_CHOC, fontSize: 24, fontWeight: 400, margin: "0 0 16px", fontFamily: FONT_BODY }}
      >
        {copy.headline}
      </Heading>
      <Text style={{ color: EMAIL_INK, fontSize: 15, lineHeight: "24px", fontFamily: FONT_BODY }}>Hi {name},</Text>
      <Text style={{ color: EMAIL_INK, fontSize: 15, lineHeight: "24px", fontFamily: FONT_BODY }}>
        Re: your application for {jobTitle}.
      </Text>
      <Text style={{ color: EMAIL_INK, fontSize: 15, lineHeight: "24px", fontFamily: FONT_BODY }}>{copy.body}</Text>
      <Text style={{ color: EMAIL_MUTED, fontSize: 13, marginTop: 32, fontFamily: FONT_BODY }}>
        The Prudential Atelier Team
      </Text>
    </EmailLayout>
  );
}
