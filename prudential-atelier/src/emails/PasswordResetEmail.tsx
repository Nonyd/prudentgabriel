import { Heading, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import EmailButton from "./components/EmailButton";
import { EMAIL_CHOC, FONT_DISPLAY } from "./components/email-tokens";

type PasswordResetEmailProps = {
  resetUrl: string;
};

export default function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout family="transactional" previewText="Reset your password">
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: EMAIL_CHOC, margin: "0 0 12px", fontFamily: FONT_DISPLAY }}>
        Reset your password
      </Heading>
      <Text style={{ fontSize: 16, color: "#2C241C" }}>
        We received a request to reset your Prudential Atelier password.
      </Text>
      <EmailButton href={resetUrl}>Reset password</EmailButton>
      <Text style={{ marginTop: 24, fontSize: 14, color: "#444" }}>This link expires in 1 hour.</Text>
      <Text style={{ fontSize: 14, color: "#444" }}>If you didn&apos;t request this, you can safely ignore this email.</Text>
      <Text style={{ marginTop: 16, fontSize: 13, color: "#666" }}>
        For your security, never share this link with anyone.
      </Text>
    </EmailLayout>
  );
}
