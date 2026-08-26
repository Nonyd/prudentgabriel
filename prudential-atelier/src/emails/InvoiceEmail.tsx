import { Heading, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";
import { EMAIL_CHOC, EMAIL_INK, EMAIL_MUTED, FONT_BODY } from "./components/email-tokens";

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
    <EmailLayout family="transactional" previewText={`Invoice ${props.invoiceNumber} — ${props.total}`}>
      <Text style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: "24px", color: EMAIL_INK, margin: "0 0 12px" }}>
        Dear {props.clientName},
      </Text>
      <Text style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: "24px", color: EMAIL_INK, margin: "0 0 20px" }}>
        Please find your invoice below. You can view and download it securely using the link.
      </Text>
      <table
        width="100%"
        border={0}
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ border: "1px solid #E2D1C2", margin: "0 0 8px" }}
      >
        <tbody>
          <tr>
            <td style={{ padding: 20 }}>
              <Text style={{ margin: 0, fontFamily: FONT_BODY, fontSize: 12, color: EMAIL_MUTED }}>Invoice #</Text>
              <Heading as="h2" style={{ margin: "4px 0 0", fontFamily: FONT_BODY, fontSize: 16, fontWeight: 500, color: EMAIL_CHOC }}>
                {props.invoiceNumber}
              </Heading>
              <Text style={{ margin: "16px 0 0", fontFamily: FONT_BODY, fontSize: 12, color: EMAIL_MUTED }}>
                Total ({props.currency})
              </Text>
              <Text style={{ margin: "4px 0 0", fontFamily: FONT_BODY, fontSize: 18, fontWeight: 500, color: EMAIL_CHOC }}>
                {props.total}
              </Text>
              {props.dueDate ? (
                <>
                  <Text style={{ margin: "16px 0 0", fontFamily: FONT_BODY, fontSize: 12, color: EMAIL_MUTED }}>Due date</Text>
                  <Text style={{ margin: "4px 0 0", fontFamily: FONT_BODY, fontSize: 14, color: EMAIL_INK }}>{props.dueDate}</Text>
                </>
              ) : null}
              {props.depositRequired ? (
                <>
                  <Text style={{ margin: "16px 0 0", fontFamily: FONT_BODY, fontSize: 12, color: EMAIL_MUTED }}>
                    Deposit required
                  </Text>
                  <Text style={{ margin: "4px 0 0", fontFamily: FONT_BODY, fontSize: 14, color: EMAIL_INK }}>
                    {props.depositRequired}
                  </Text>
                </>
              ) : null}
            </td>
          </tr>
        </tbody>
      </table>
      {props.clientNote ? (
        <Text style={{ margin: "16px 0 0", fontFamily: FONT_BODY, fontSize: 14, color: EMAIL_MUTED, fontStyle: "italic" }}>
          {props.clientNote}
        </Text>
      ) : null}
      <EmailButton href={props.publicLink}>View invoice</EmailButton>
      <Text style={{ margin: "8px 0 0", fontFamily: FONT_BODY, fontSize: 13, color: EMAIL_MUTED }}>
        You can also download the PDF from the page above.
      </Text>
      {props.footerNote ? (
        <Text style={{ margin: "20px 0 0", fontFamily: FONT_BODY, fontSize: 13, color: EMAIL_MUTED, fontStyle: "italic" }}>
          {props.footerNote}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
