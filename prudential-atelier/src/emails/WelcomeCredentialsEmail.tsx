import { Heading, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";
import { EMAIL_CHOC, EMAIL_INK, EMAIL_MUTED, FONT_BODY, FONT_UI } from "./components/email-tokens";

type Props = {
  firstName: string;
  email: string;
  tempPassword: string;
  sourceLabel: string;
  trackUrl: string;
  loginUrl: string;
};

export function subjectWelcomeCredentials(firstName: string): string {
  return `Welcome to Prudential Atelier, ${firstName} — your account is ready`;
}

export default function WelcomeCredentialsEmail({
  firstName,
  email,
  tempPassword,
  sourceLabel,
  trackUrl,
  loginUrl,
}: Props) {
  return (
    <EmailLayout family="transactional" previewText={`Your Prudential Atelier account is ready, ${firstName}`}>
      <Heading as="h1" style={{ fontFamily: FONT_BODY, fontSize: 24, fontWeight: 400, color: EMAIL_CHOC, margin: "0 0 12px" }}>
        Welcome, {firstName}.
      </Heading>
      <Text style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: "24px", color: EMAIL_INK }}>
        Your account has been created so you can follow your {sourceLabel} with us.
      </Text>
      <table
        width="100%"
        border={0}
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ border: "1px solid #E2D1C2", margin: "20px 0 8px" }}
      >
        <tbody>
          <tr>
            <td style={{ padding: 20 }}>
              <Text
                style={{
                  margin: 0,
                  fontFamily: FONT_UI,
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: EMAIL_MUTED,
                }}
              >
                Your login details
              </Text>
              <Text style={{ margin: "12px 0 4px", fontFamily: FONT_BODY, fontSize: 14, color: EMAIL_INK }}>
                <strong>Email:</strong> {email}
              </Text>
              <Text style={{ margin: 0, fontFamily: FONT_BODY, fontSize: 14, color: EMAIL_INK }}>
                <strong>Temporary password:</strong> {tempPassword}
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
      <EmailButton href={loginUrl}>Log in</EmailButton>
      <Text
        style={{
          margin: "24px 0 0",
          fontFamily: FONT_UI,
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: EMAIL_MUTED,
        }}
      >
        Track your order (no login needed)
      </Text>
      <Text style={{ fontFamily: FONT_BODY, fontSize: 14, color: EMAIL_INK }}>Follow your commission at any time:</Text>
      <EmailButton href={trackUrl}>Track my order</EmailButton>
    </EmailLayout>
  );
}
