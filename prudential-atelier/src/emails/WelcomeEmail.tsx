import { Heading, Section, Text } from "@react-email/components";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

export const subject = (firstName: string) => `Welcome to ${CUSTOMER_HOUSE_NAME}, ${firstName} ✨`;

type WelcomeEmailProps = {
  firstName: string;
  pointsBalance: number;
  referralCode: string;
};

export default function WelcomeEmail({ firstName, pointsBalance, referralCode }: WelcomeEmailProps) {
  const credit = pointsBalance;
  return (
    <EmailLayout family="relationship" previewText={`Welcome, ${firstName}`}>
      <Heading as="h1" style={{ fontSize: 32, fontWeight: 400, color: "#2d2d2d", margin: "0 0 16px" }}>
        Welcome, {firstName}.
      </Heading>
      <Text style={{ fontSize: 16, lineHeight: 1.6, color: "#2d2d2d" }}>
        You&apos;ve joined one of Nigeria&apos;s most celebrated fashion houses.
      </Text>
      {pointsBalance > 0 ? (
        <Section
          style={{
            marginTop: 24,
            padding: 16,
            border: "1px solid #C9A84C",
            backgroundColor: "rgba(201,168,76,0.08)",
          }}
        >
          <Text style={{ margin: 0, fontSize: 15, color: "#2d2d2d" }}>
            You have {pointsBalance} Prudent Points waiting — worth ₦{Math.round(credit).toLocaleString("en-NG")}{" "}
            store credit.
          </Text>
        </Section>
      ) : null}
      <EmailButton href={`${APP}/rtw`}>Explore the collection</EmailButton>
      <Text style={{ marginTop: 32, fontSize: 13, color: "#555" }}>
        Your referral code: <strong>{referralCode}</strong>
        <br />
        Share it with friends to earn more points.
      </Text>
    </EmailLayout>
  );
}

export function WelcomeEmailPreview() {
  return <WelcomeEmail firstName="Amara" pointsBalance={500} referralCode="AMARA-REF-001" />;
}
