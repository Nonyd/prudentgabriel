import { Heading, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";
import { EMAIL_CHOC, EMAIL_INK, FONT_BODY } from "./components/email-tokens";

type Props = { loginUrl: string };

export default function AccountExistsEmail({ loginUrl }: Props) {
  return (
    <EmailLayout family="transactional" previewText="You already have an account">
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: EMAIL_CHOC, margin: "0 0 12px" }}>
        You already have an account
      </Heading>
      <Text style={{ fontSize: 16, color: EMAIL_INK, fontFamily: FONT_BODY }}>
        Someone tried to register with this email. If that was you, sign in instead.
      </Text>
      <EmailButton href={loginUrl}>Sign in</EmailButton>
    </EmailLayout>
  );
}
