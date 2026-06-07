import type { ApplicationStatus } from "@prisma/client";
import { Body, Container, Heading, Html, Preview, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";

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
    <Html>
      <Preview>{copy.subject} — {jobTitle}</Preview>
      <EmailLayout>
        <Body style={{ backgroundColor: "#FAF8F5", fontFamily: "Georgia, serif" }}>
          <Container style={{ padding: "32px 24px", maxWidth: "560px" }}>
            <Heading style={{ color: "#442913", fontSize: "24px", fontWeight: 400 }}>{copy.headline}</Heading>
            <Text style={{ color: "#6B6B68", fontSize: "15px", lineHeight: 1.7 }}>Hi {name},</Text>
            <Text style={{ color: "#6B6B68", fontSize: "15px", lineHeight: 1.7 }}>
              Re: your application for {jobTitle}.
            </Text>
            <Text style={{ color: "#6B6B68", fontSize: "15px", lineHeight: 1.7 }}>{copy.body}</Text>
            <Text style={{ color: "#A8A8A4", fontSize: "13px", marginTop: "32px" }}>
              — The Prudential Atelier Team
            </Text>
          </Container>
        </Body>
      </EmailLayout>
    </Html>
  );
}
