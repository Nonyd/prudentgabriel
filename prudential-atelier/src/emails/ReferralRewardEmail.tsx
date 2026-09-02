import { Heading, Section, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

export type ReferralRewardEmailProps = {
  firstName: string;
  creditNGN: number;
};

export default function ReferralRewardEmail({ firstName, creditNGN }: ReferralRewardEmailProps) {
  return (
    <EmailLayout family="relationship" previewText={`You've earned a referral reward — ${CUSTOMER_HOUSE_NAME}`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#442913", margin: "0 0 12px" }}>
        You&apos;ve earned a referral reward, {firstName}!
      </Heading>
      <Text style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>
        Your friend just made their first purchase. Prudent Points have been added to your account — every point is
        worth ₦1 towards a future piece.
      </Text>
      <Section style={{ marginTop: 20, padding: 16, backgroundColor: "rgba(201,168,76,0.08)", borderLeft: "3px solid #C9A84C" }}>
        <Text style={{ margin: 0, fontSize: 18, color: "#442913", fontWeight: 600 }}>
          ₦{creditNGN.toLocaleString("en-NG")} store credit
        </Text>
        <Text style={{ margin: "8px 0 0", fontSize: 14, color: "#555" }}>
          Added to your account — redeem on your next order.
        </Text>
      </Section>
      <EmailButton href={`${APP}/account/loyalty`}>View your account</EmailButton>
    </EmailLayout>
  );
}
