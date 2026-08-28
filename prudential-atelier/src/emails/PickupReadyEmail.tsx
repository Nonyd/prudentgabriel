import { Heading, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";

type Props = {
  firstName: string;
  orderNumber: string;
  collectionCode: string;
  pickupName: string;
  address: string;
  hours: string;
  instructions?: string | null;
};

export default function PickupReadyEmail({
  firstName,
  orderNumber,
  collectionCode,
  pickupName,
  address,
  hours,
  instructions,
}: Props) {
  return (
    <EmailLayout family="relationship" previewText={`Your piece is ready — collection code ${collectionCode}`}>
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: "#442913", margin: "0 0 12px" }}>
        Your piece is ready.
      </Heading>
      <Text style={{ fontSize: 16, color: "#2d2d2d" }}>Hi {firstName},</Text>
      <Text style={{ fontSize: 15, color: "#444", lineHeight: 1.6 }}>
        Order #{orderNumber} is waiting for you at {pickupName}.
      </Text>
      <Text style={{ fontSize: 22, letterSpacing: 3, color: "#442913", margin: "20px 0" }}>{collectionCode}</Text>
      <Text style={{ fontSize: 14, color: "#444", lineHeight: 1.6 }}>
        {address}
        <br />
        {hours}
      </Text>
      {instructions ? (
        <Text style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>{instructions}</Text>
      ) : null}
      <Text style={{ fontSize: 13, color: "#888", marginTop: 24 }}>Bring the code and a matching ID.</Text>
    </EmailLayout>
  );
}
