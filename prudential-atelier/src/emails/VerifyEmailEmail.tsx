import { Heading, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";
import { EMAIL_CHOC, EMAIL_INK, FONT_BODY } from "./components/email-tokens";

type Props = { firstName: string; verifyUrl: string };

export default function VerifyEmailEmail({ firstName, verifyUrl }: Props) {
  return (
    <EmailLayout family="transactional" previewText="Confirm your email address">
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: EMAIL_CHOC, margin: "0 0 12px" }}>
        Confirm your email
      </Heading>
      <Text style={{ fontSize: 16, color: EMAIL_INK, fontFamily: FONT_BODY }}>
        Dear {firstName}, please confirm this is your email address. Once you do, your account shows everything the
        atelier holds under it: commissions, consultations and orders placed before you signed up.
      </Text>
      <EmailButton href={verifyUrl}>Confirm my email</EmailButton>
      <Text style={{ fontSize: 13, color: EMAIL_INK, fontFamily: FONT_BODY, marginTop: 20 }}>
        The link works for 24 hours. If you did not create an account with us, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
