import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";
import { CatalogHeading } from "./components/CatalogHeading";

export type ReceiptReminderEmailProps = {
  firstName: string;
  orderRef: string;
  confirmUrl: string;
  catalogHeading?: string;
  catalogBody?: string;
  catalogCtaLabel?: string;
};

export default function ReceiptReminderEmail({
  firstName,
  orderRef,
  confirmUrl,
  catalogHeading,
  catalogBody,
  catalogCtaLabel,
}: ReceiptReminderEmailProps) {
  return (
    <EmailLayout family="relationship" previewText={`Please confirm receipt of ${orderRef}`}>
      <CatalogHeading
        heading={catalogHeading}
        body={catalogBody}
        fallbackHeading="Have you received your garment?"
        fallbackBody={`Hi ${firstName}, your commission ${orderRef} was marked delivered a week ago. If it has arrived safely, please confirm receipt so we can close your file.`}
      />
      <EmailButton href={confirmUrl}>{catalogCtaLabel || "Confirm receipt"}</EmailButton>
    </EmailLayout>
  );
}

export function subjectReceiptReminder(orderRef: string): string {
  return `Reminder: confirm receipt of ${orderRef} — ${CUSTOMER_HOUSE_NAME}`;
}
