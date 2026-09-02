import { Link, Text } from "@react-email/components";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import { UNSUBSCRIBE_URL_PLACEHOLDER } from "@/lib/email-priority";
import {
  EMAIL_FOOTER_BG,
  EMAIL_GOLD,
  EMAIL_MUTED,
  EMAIL_SAND,
  FONT_BODY,
  FONT_UI,
  type EmailFamily,
} from "./email-tokens";

type EmailFooterProps = {
  family: EmailFamily;
  unsubscribeUrl?: string;
};

export default function EmailFooter({ family, unsubscribeUrl }: EmailFooterProps) {
  const showUnsub = family === "marketing";
  const unsub = unsubscribeUrl || UNSUBSCRIBE_URL_PLACEHOLDER;
  const quiet = "rgba(226,209,194,0.62)";

  return (
    <table
      width="100%"
      border={0}
      cellPadding={0}
      cellSpacing={0}
      role="presentation"
      style={{ backgroundColor: EMAIL_FOOTER_BG }}
    >
      <tbody>
        <tr>
          <td style={{ padding: "28px 36px 32px", textAlign: "center" }}>
            <table
              border={0}
              cellPadding={0}
              cellSpacing={0}
              role="presentation"
              align="center"
              style={{ margin: "0 auto 16px" }}
            >
              <tbody>
                <tr>
                  <td
                    height={1}
                    width={64}
                    style={{ backgroundColor: EMAIL_GOLD, fontSize: 0, lineHeight: 0 }}
                  >
                    &nbsp;
                  </td>
                </tr>
              </tbody>
            </table>
            <Text
              style={{
                margin: "0 0 8px",
                fontFamily: FONT_BODY,
                fontSize: 12,
                color: quiet,
                lineHeight: "18px",
              }}
            >
              {CUSTOMER_HOUSE_NAME}
            </Text>
            <Text
              style={{
                margin: "0 0 6px",
                fontFamily: FONT_UI,
                fontSize: 11,
                color: quiet,
                lineHeight: "18px",
              }}
            >
              14 Bode Thomas Street, Surulere, Lagos, Nigeria
            </Text>
            <Text style={{ margin: "0 0 16px", fontFamily: FONT_UI, fontSize: 11, color: quiet }}>
              <Link href="mailto:hello@prudentgabriel.com" style={{ color: EMAIL_SAND, textDecoration: "none" }}>
                hello@prudentgabriel.com
              </Link>
            </Text>
            {showUnsub ? (
              <Text
                style={{
                  margin: 0,
                  fontFamily: FONT_UI,
                  fontSize: 11,
                  color: EMAIL_MUTED,
                  lineHeight: "18px",
                }}
              >
                You received this because you subscribed or have shopped with the house.
                <br />
                <Link href={unsub} style={{ color: EMAIL_GOLD, textDecoration: "underline" }}>
                  Unsubscribe
                </Link>
              </Text>
            ) : (
              <Text
                style={{
                  margin: 0,
                  fontFamily: FONT_UI,
                  fontSize: 11,
                  color: quiet,
                  lineHeight: "18px",
                }}
              >
                This message is about an order or account. It is not marketing mail.
              </Text>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
