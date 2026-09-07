import { Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import { CatalogHeading } from "./components/CatalogHeading";

type Props = {
  firstName: string;
  orderNumber: string;
  collectionCode: string;
  pickupName: string;
  address: string;
  hours: string;
  instructions?: string | null;
  catalogHeading?: string;
  catalogBody?: string;
};

export default function PickupReadyEmail({
  firstName,
  orderNumber,
  collectionCode,
  pickupName,
  address,
  hours,
  instructions,
  catalogHeading,
  catalogBody,
}: Props) {
  return (
    <EmailLayout family="relationship" previewText={`Your piece is ready — collection code ${collectionCode}`}>
      <CatalogHeading
        heading={catalogHeading}
        body={catalogBody}
        fallbackHeading="Your piece is ready."
        fallbackBody={`Hi ${firstName},\n\nOrder #${orderNumber} is waiting for you at ${pickupName}.`}
      />
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
