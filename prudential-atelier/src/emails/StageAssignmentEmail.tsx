import { Button, Heading, Section, Text } from "@react-email/components";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

export type StageAssignmentEmailProps = {
  firstName: string;
  stageName: string;
  orderRef: string;
  outfitName: string;
  deliveryDate?: string;
};

export default function StageAssignmentEmail({
  firstName,
  stageName,
  orderRef,
  outfitName,
  deliveryDate,
}: StageAssignmentEmailProps) {
  return (
    <EmailLayout previewText={`New assignment — ${orderRef}`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#442913", margin: "0 0 12px" }}>
        You&apos;ve been assigned to a new commission
      </Heading>
      <Text style={{ fontSize: 16, color: "#333" }}>Hi {firstName},</Text>
      <Section style={{ marginTop: 20, padding: 16, backgroundColor: "rgba(201,168,76,0.08)" }}>
        <Text style={{ margin: "0 0 8px", fontSize: 15 }}>
          <strong>Order:</strong> {orderRef}
        </Text>
        <Text style={{ margin: "0 0 8px", fontSize: 15 }}>
          <strong>Piece:</strong> {outfitName}
        </Text>
        <Text style={{ margin: "0 0 8px", fontSize: 15 }}>
          <strong>Your role:</strong> {stageName}
        </Text>
        {deliveryDate ? (
          <Text style={{ margin: 0, fontSize: 15 }}>
            <strong>Delivery date:</strong> {deliveryDate}
          </Text>
        ) : null}
      </Section>
      <Section style={{ marginTop: 24, textAlign: "center" as const }}>
        <Button
          href={`${APP}/staff-login`}
          style={{
            backgroundColor: "#442913",
            color: "#E2D1C2",
            padding: "14px 28px",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            borderRadius: 2,
          }}
        >
          View in staff portal
        </Button>
      </Section>
    </EmailLayout>
  );
}
