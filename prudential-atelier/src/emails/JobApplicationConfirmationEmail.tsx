import { Body, Container, Heading, Html, Preview, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";

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
    <Html>
      <Preview>Application received — {jobTitle}</Preview>
      <EmailLayout>
        <Body style={{ backgroundColor: "#FAF8F5", fontFamily: "Georgia, serif" }}>
          <Container style={{ padding: "32px 24px", maxWidth: "560px" }}>
            <Heading style={{ color: "#442913", fontSize: "24px", fontWeight: 400 }}>
              Application received
            </Heading>
            <Text style={{ color: "#6B6B68", fontSize: "15px", lineHeight: 1.7 }}>
              Hi {name},
            </Text>
            <Text style={{ color: "#6B6B68", fontSize: "15px", lineHeight: 1.7 }}>
              Thank you for applying for the {jobTitle} position at Prudential Atelier.
            </Text>
            <Text style={{ color: "#6B6B68", fontSize: "15px", lineHeight: 1.7 }}>
              We have received your application and will review it carefully. If your profile matches what we
              are looking for, we will be in touch within 14 working days.
            </Text>
            <Text style={{ color: "#442913", fontSize: "13px", marginTop: "24px" }}>
              Application reference: {applicationId}
            </Text>
            <Text style={{ color: "#A8A8A4", fontSize: "13px", marginTop: "32px" }}>
              — The Prudential Atelier Team
            </Text>
          </Container>
        </Body>
      </EmailLayout>
    </Html>
  );
}
