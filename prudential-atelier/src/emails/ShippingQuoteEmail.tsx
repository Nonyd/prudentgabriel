import { Heading, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import EmailButton from "./components/EmailButton";

type Bank = { bankName: string; accountNumber: string; accountName: string };

type Props = {
  firstName: string;
  orderNumber: string;
  amountLabel: string;
  paymentRef: string;
  bank: Bank;
  payUrl: string;
};

export default function ShippingQuoteEmail({
  firstName,
  orderNumber,
  amountLabel,
  paymentRef,
  bank,
  payUrl,
}: Props) {
  return (
    <EmailLayout family="transactional" previewText={`Shipping for order #${orderNumber}`}>
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        Shipping confirmed
      </Heading>
      <Text style={{ fontSize: 16, color: "#2d2d2d" }}>Hi {firstName},</Text>
      <Text style={{ fontSize: 15, color: "#444", lineHeight: 1.6 }}>
        We have confirmed shipping for order #{orderNumber}. The amount due is {amountLabel}.
      </Text>
      <Text style={{ fontSize: 18, letterSpacing: 1, color: "#442913" }}>{paymentRef}</Text>
      {bank.accountNumber ? (
        <>
          <Text style={{ fontSize: 14, color: "#444" }}>
            {bank.bankName}
            <br />
            {bank.accountNumber}
            <br />
            {bank.accountName}
          </Text>
          <Text style={{ fontSize: 13, color: "#666" }}>
            Use the reference above as the transfer narration so we can match your payment.
          </Text>
        </>
      ) : null}
      <EmailButton href={payUrl}>View your order</EmailButton>
    </EmailLayout>
  );
}
