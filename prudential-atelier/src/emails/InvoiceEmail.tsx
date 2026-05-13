import { Body, Button, Container, Head, Html, Preview, Section, Text } from "@react-email/components";

export interface InvoiceEmailProps {
  invoiceNumber: string;
  clientName: string;
  businessName: string;
  total: string;
  currency: string;
  dueDate?: string;
  depositRequired?: string;
  publicLink: string;
  clientNote?: string;
  footerNote?: string;
}

export function subjectInvoiceEmail(props: InvoiceEmailProps): string {
  return `Invoice ${props.invoiceNumber} from ${props.businessName} — ${props.total}`;
}

export default function InvoiceEmail(props: InvoiceEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Invoice ${props.invoiceNumber} — ${props.total}`}</Preview>
      <Body style={{ backgroundColor: "#FAF6EF", fontFamily: "Georgia, serif", color: "#2d2d2d" }}>
        <Section style={{ backgroundColor: "#37392d", padding: "20px 24px", textAlign: "center" as const }}>
          <Text style={{ color: "#fff", fontSize: 14, letterSpacing: "0.2em", margin: 0 }}>PRUDENTIAL ATELIER</Text>
        </Section>
        <Container style={{ padding: "28px 24px", maxWidth: 560 }}>
          <Text style={{ fontSize: 15, lineHeight: 1.5 }}>Dear {props.clientName},</Text>
          <Text style={{ fontSize: 15, lineHeight: 1.5, marginTop: 12 }}>
            Please find your invoice below. You can view and download it securely using the link.
          </Text>
          <Section
            style={{
              marginTop: 24,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "#37392d",
              padding: 20,
              backgroundColor: "#fff",
            }}
          >
            <Text style={{ margin: 0, fontSize: 13, color: "#6B6B68" }}>Invoice #</Text>
            <Text style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 600 }}>{props.invoiceNumber}</Text>
            <Text style={{ margin: "16px 0 0", fontSize: 13, color: "#6B6B68" }}>Total ({props.currency})</Text>
            <Text style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 600 }}>{props.total}</Text>
            {props.dueDate ? (
              <>
                <Text style={{ margin: "16px 0 0", fontSize: 13, color: "#6B6B68" }}>Due date</Text>
                <Text style={{ margin: "4px 0 0", fontSize: 14 }}>{props.dueDate}</Text>
              </>
            ) : null}
            {props.depositRequired ? (
              <>
                <Text style={{ margin: "16px 0 0", fontSize: 13, color: "#6B6B68" }}>Deposit required</Text>
                <Text style={{ margin: "4px 0 0", fontSize: 14 }}>{props.depositRequired}</Text>
              </>
            ) : null}
          </Section>
          {props.clientNote ? (
            <Text style={{ marginTop: 20, fontSize: 14, color: "#6B6B68", fontStyle: "italic" }}>{props.clientNote}</Text>
          ) : null}
          <Section style={{ textAlign: "center" as const, marginTop: 28 }}>
            <Button
              href={props.publicLink}
              style={{
                backgroundColor: "#37392d",
                color: "#fff",
                padding: "14px 28px",
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              View &amp; download invoice
            </Button>
          </Section>
          <Text style={{ marginTop: 16, fontSize: 13, color: "#6B6B68", textAlign: "center" as const }}>
            You can also download the PDF from the page above.
          </Text>
          {props.footerNote ? (
            <Text style={{ marginTop: 24, fontSize: 13, color: "#6B6B68", fontStyle: "italic", textAlign: "center" as const }}>
              {props.footerNote}
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}
