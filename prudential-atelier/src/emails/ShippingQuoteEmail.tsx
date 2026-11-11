import { Section, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import EmailButton from "./components/EmailButton";
import { CatalogHeading } from "./components/CatalogHeading";

type Bank = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  iban?: string;
  swiftBic?: string;
  sortCode?: string;
  routingNumber?: string;
  intermediaryBank?: string;
  instructions?: string;
};

type Props = {
  firstName: string;
  orderNumber: string;
  amountLabel: string;
  carrier?: string | null;
  note?: string | null;
  bank: Bank;
  /** The lasting pay page: a fresh Paystack checkout on every click. */
  payUrl: string;
  /** A reminder for a quote still unpaid, rather than the first email. */
  reminder?: boolean;
  catalogHeading?: string;
  catalogBody?: string;
  catalogCtaLabel?: string;
};

const label = { fontSize: 11, letterSpacing: 1, textTransform: "uppercase" as const, color: "#8a7a6a", margin: "0 0 2px" };
const value = { fontSize: 16, color: "#2d2d2d", margin: "0 0 12px" };

export default function ShippingQuoteEmail({
  firstName,
  orderNumber,
  amountLabel,
  carrier,
  note,
  bank,
  payUrl,
  reminder = false,
  catalogHeading,
  catalogBody,
  catalogCtaLabel,
}: Props) {
  return (
    <EmailLayout
      family="transactional"
      previewText={
        reminder
          ? `Shipping for order #${orderNumber} is still unpaid: ${amountLabel}`
          : `Shipping for order #${orderNumber}: ${amountLabel}. Pay online in a minute.`
      }
    >
      {reminder ? (
        <CatalogHeading
          fallbackHeading="A reminder: your shipping is unpaid"
          fallbackBody={`Dear ${firstName},\n\nYour piece is ready to go, but shipping for order #${orderNumber} has not been paid yet. As soon as it is, we will send it on its way.`}
        />
      ) : (
        <CatalogHeading
          heading={catalogHeading}
          body={catalogBody}
          fallbackHeading="Your shipping quote is ready"
          fallbackBody={`Dear ${firstName},\n\nYour piece is almost on its way. Shipping for order #${orderNumber} is ${amountLabel}. Pay below and we will send it to you right away.`}
        />
      )}

      <Section style={{ background: "#f7f1ea", padding: "18px 20px", margin: "16px 0 8px" }}>
        <Text style={label}>Amount to pay</Text>
        <Text style={{ ...value, fontSize: 24, color: "#442913" }}>{amountLabel}</Text>
        <Text style={label}>Order</Text>
        <Text style={value}>#{orderNumber}</Text>
        {carrier ? (
          <>
            <Text style={label}>Carrier</Text>
            <Text style={value}>{carrier}</Text>
          </>
        ) : null}
        {note ? (
          <>
            <Text style={label}>Note from us</Text>
            <Text style={{ ...value, whiteSpace: "pre-wrap" }}>{note}</Text>
          </>
        ) : null}
      </Section>

      <EmailButton href={payUrl}>{(!reminder && catalogCtaLabel) || "Pay shipping"}</EmailButton>
      <Text style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
        Pay by card, bank transfer or USSD through Paystack. This link does not expire, so you can use it whenever
        you are ready.
      </Text>

      {bank.accountNumber ? (
        <>
          <Text style={{ fontSize: 14, color: "#2d2d2d", margin: "24px 0 4px" }}>
            <strong>Prefer a direct bank transfer?</strong>
          </Text>
          <Text style={{ fontSize: 14, color: "#444", margin: 0 }}>
            Bank: {bank.bankName}
            <br />
            Account number: {bank.accountNumber}
            <br />
            Account name: {bank.accountName}
            {bank.iban ? (
              <>
                <br />
                IBAN: {bank.iban}
              </>
            ) : null}
            {bank.swiftBic ? (
              <>
                <br />
                SWIFT: {bank.swiftBic}
              </>
            ) : null}
            {bank.sortCode ? (
              <>
                <br />
                Sort code: {bank.sortCode}
              </>
            ) : null}
            {bank.routingNumber ? (
              <>
                <br />
                Routing: {bank.routingNumber}
              </>
            ) : null}
          </Text>
          {bank.instructions ? <Text style={{ fontSize: 13, color: "#666" }}>{bank.instructions}</Text> : null}
          <Text style={{ fontSize: 13, color: "#666" }}>
            Use your order number <strong>{orderNumber}</strong> as the transfer narration, then upload the receipt on
            the same pay page (the button above) so we can confirm it.
          </Text>
        </>
      ) : null}
    </EmailLayout>
  );
}
