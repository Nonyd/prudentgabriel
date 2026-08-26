import { Heading, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import { EMAIL_CHOC, EMAIL_INK, EMAIL_MUTED, FONT_BODY } from "./components/email-tokens";

export function JobApplicationConfirmationEmail({
  name,
  jobTitle,
  applicationId,
}: {
  name: string;
  jobTitle: string;
  applicationId: string;
}) {
  return (
    <EmailLayout family="transactional" previewText={`Application received — ${jobTitle}`}>
      <Heading
        as="h1"
        style={{ color: EMAIL_CHOC, fontSize: 24, fontWeight: 400, margin: "0 0 16px", fontFamily: FONT_BODY }}
      >
        Application received
      </Heading>
      <Text style={{ color: EMAIL_INK, fontSize: 15, lineHeight: "24px", fontFamily: FONT_BODY }}>Hi {name},</Text>
      <Text style={{ color: EMAIL_INK, fontSize: 15, lineHeight: "24px", fontFamily: FONT_BODY }}>
        Thank you for applying for the {jobTitle} position at Prudential Atelier.
      </Text>
      <Text style={{ color: EMAIL_INK, fontSize: 15, lineHeight: "24px", fontFamily: FONT_BODY }}>
        We have received your application and will review it carefully. If your profile matches what we are looking
        for, we will be in touch within 14 working days.
      </Text>
      <Text style={{ color: EMAIL_CHOC, fontSize: 13, marginTop: 24, fontFamily: FONT_BODY }}>
        Application reference: {applicationId}
      </Text>
      <Text style={{ color: EMAIL_MUTED, fontSize: 13, marginTop: 32, fontFamily: FONT_BODY }}>
        The Prudential Atelier Team
      </Text>
    </EmailLayout>
  );
}
