import { Heading, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";
import { getPublicAppUrl } from "@/lib/app-url";

const APP = getPublicAppUrl();

export type PointsExpiryEmailProps = {
  firstName: string;
  points: number;
  expiryLabel: string;
};

export default function PointsExpiryEmail({ firstName, points, expiryLabel }: PointsExpiryEmailProps) {
  return (
    <EmailLayout family="relationship" previewText="Prudent Points expiring soon">
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: "#442913", margin: "0 0 12px" }}>
        {firstName}, some Prudent Points lapse soon.
      </Heading>
      <Text style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>
        {points.toLocaleString()} Prudent Points will expire on {expiryLabel}. Every point is worth ₦1 towards a
        future piece.
      </Text>
      <EmailButton href={`${APP}/account/loyalty`}>View your Prudent Points</EmailButton>
    </EmailLayout>
  );
}
