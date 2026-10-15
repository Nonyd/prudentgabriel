import { Heading, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import { EMAIL_CHOC, EMAIL_INK, FONT_BODY } from "./components/email-tokens";

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
      <Text style={{ color: EMAIL_INK, fontSize: 15, lineHeight: "24px", fontFamily: FONT_BODY }}>Dear {name},</Text>
      <Text style={{ color: EMAIL_INK, fontSize: 15, lineHeight: "24px", fontFamily: FONT_BODY }}>
        Thank you for applying for the {jobTitle} position at Prudent Gabriel. We are delighted that you would like
        to join us.
      </Text>
      <Text style={{ color: EMAIL_INK, fontSize: 15, lineHeight: "24px", fontFamily: FONT_BODY }}>
        We have received your application and will review it with care. If your profile matches what we are
        looking for, we will be in touch within 14 working days.
      </Text>
      <Text style={{ color: EMAIL_CHOC, fontSize: 13, marginTop: 24, fontFamily: FONT_BODY }}>
        Application reference: {applicationId}
      </Text>
    </EmailLayout>
  );
}
