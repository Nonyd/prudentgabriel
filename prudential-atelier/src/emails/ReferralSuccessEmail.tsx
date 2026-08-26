import { Heading, Section, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

type ReferralSuccessEmailProps = {
  referrerName: string;
  friendFirstName: string;
  pointsEarned: number;
  newBalance: number;
};

export default function ReferralSuccessEmail({
  referrerName,
  friendFirstName,
  pointsEarned,
  newBalance,
}: ReferralSuccessEmailProps) {
  return (
    <EmailLayout family="relationship" previewText={`You earned ${pointsEarned} points`}>
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        You just earned {pointsEarned} points!
      </Heading>
      <Text style={{ fontSize: 16, color: "#2d2d2d" }}>
        Hi {referrerName}, {friendFirstName} signed up using your referral link.
      </Text>
      <Section
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #C9A84C",
          backgroundColor: "rgba(201,168,76,0.08)",
        }}
      >
        <Text style={{ margin: 0, fontSize: 16, color: "#442913" }}>+{pointsEarned} points added</Text>
        <Text style={{ margin: "8px 0 0", fontSize: 15 }}>
          Your new balance: {newBalance} pts = ₦{newBalance.toLocaleString("en-NG")}
        </Text>
      </Section>
      <EmailButton href={`${APP}/account/wallet`}>View your wallet</EmailButton>
    </EmailLayout>
  );
}
