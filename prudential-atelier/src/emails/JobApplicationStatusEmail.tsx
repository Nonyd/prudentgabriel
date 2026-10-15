import type { ApplicationStatus } from "@prisma/client";
import { Heading, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import { EMAIL_CHOC, EMAIL_INK, FONT_BODY } from "./components/email-tokens";

const STATUS_COPY: Record<
  ApplicationStatus,
  { subject: string; headline: string; body: string } | null
> = {
  NEW: null,
  REVIEWED: null,
  SHORTLISTED: {
    subject: "You have been shortlisted",
    headline: "Congratulations, you have been shortlisted",
    body: "Your application truly stood out to us, and we are delighted to share this news. Our team will be in touch shortly with the next steps.",
  },
  INTERVIEWED: {
    subject: "An invitation to interview",
    headline: "We would love to meet you",
    body: "Thank you for your interest in joining Prudent Gabriel. We would be delighted to invite you for an interview. Our team will follow up with scheduling details.",
  },
  REJECTED: {
    subject: "Thank you for applying",
    headline: "Thank you for your application",
    body: "Thank you sincerely for the time and care you gave to your application. After careful review, we will not be moving forward at this time. We wish you every success in your career.",
  },
  HIRED: {
    subject: "Welcome to Prudent Gabriel",
    headline: "Welcome to Prudent Gabriel",
    body: "We are truly delighted to offer you a place on our team, and we cannot wait to welcome you. Our HR team will reach out with your onboarding details.",
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
      <Text style={{ color: EMAIL_INK, fontSize: 15, lineHeight: "24px", fontFamily: FONT_BODY }}>Dear {name},</Text>
      <Text style={{ color: EMAIL_INK, fontSize: 15, lineHeight: "24px", fontFamily: FONT_BODY }}>
        We are writing about your application for the {jobTitle} position.
      </Text>
      <Text style={{ color: EMAIL_INK, fontSize: 15, lineHeight: "24px", fontFamily: FONT_BODY }}>{copy.body}</Text>
    </EmailLayout>
  );
}
