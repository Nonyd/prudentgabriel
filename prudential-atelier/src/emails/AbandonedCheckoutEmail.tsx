import { Heading, Img, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import EmailButton from "./components/EmailButton";
import { EMAIL_CHOC, EMAIL_INK, EMAIL_MUTED, FONT_BODY, FONT_DISPLAY } from "./components/email-tokens";

export type AbandonedCheckoutLine = {
  name: string;
  quantity: number;
  imageUrl?: string | null;
  priceLabel?: string;
  size?: string;
  color?: string;
};

type AbandonedCheckoutEmailProps = {
  firstName: string;
  lines: AbandonedCheckoutLine[];
  restoreUrl: string;
  currencyNote?: string;
};

export default function AbandonedCheckoutEmail({
  firstName,
  lines,
  restoreUrl,
  currencyNote,
}: AbandonedCheckoutEmailProps) {
  const greeting = firstName?.trim() ? firstName.trim() : "there";

  return (
    <EmailLayout family="marketing" previewText="Your pieces are still in the bag">
      <Heading
        as="h1"
        style={{
          margin: "0 0 12px",
          fontFamily: FONT_DISPLAY,
          fontSize: 28,
          fontWeight: 400,
          color: EMAIL_CHOC,
          lineHeight: "34px",
        }}
      >
        Still in your bag
      </Heading>
      <Text
        style={{
          margin: "0 0 24px",
          fontFamily: FONT_BODY,
          fontSize: 15,
          lineHeight: "24px",
          color: EMAIL_INK,
        }}
      >
        {greeting}, you left these waiting. Stock moves. The bag is as you left it.
      </Text>
      <table width="100%" border={0} cellPadding={0} cellSpacing={0} role="presentation">
        <tbody>
          {lines.map((line, idx) => {
            const meta = [line.size ? `Size ${line.size}` : null, line.color, line.priceLabel]
              .filter(Boolean)
              .join(" · ");
            return (
              <tr key={`${line.name}-${idx}`}>
                <td style={{ padding: "0 0 20px" }}>
                  <table width="100%" border={0} cellPadding={0} cellSpacing={0} role="presentation">
                    <tbody>
                      <tr>
                        <td width={96} valign="top" style={{ paddingRight: 16 }}>
                          {line.imageUrl ? (
                            <Img
                              src={line.imageUrl}
                              alt={line.name}
                              width={96}
                              height={128}
                              style={{ display: "block", border: 0, width: 96, height: "auto" }}
                            />
                          ) : (
                            <table
                              width={96}
                              border={0}
                              cellPadding={0}
                              cellSpacing={0}
                              role="presentation"
                              style={{ backgroundColor: "#EDE4D4", height: 96 }}
                            >
                              <tbody>
                                <tr>
                                  <td
                                    width={96}
                                    style={{
                                      height: 96,
                                      fontFamily: FONT_BODY,
                                      fontSize: 11,
                                      color: EMAIL_MUTED,
                                      textAlign: "center",
                                    }}
                                  >
                                    {line.name}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          )}
                        </td>
                        <td valign="top">
                          <Text
                            style={{
                              margin: "0 0 4px",
                              fontFamily: FONT_DISPLAY,
                              fontSize: 16,
                              color: EMAIL_CHOC,
                              lineHeight: "22px",
                            }}
                          >
                            {line.name}
                          </Text>
                          <Text
                            style={{
                              margin: 0,
                              fontFamily: FONT_BODY,
                              fontSize: 13,
                              color: EMAIL_MUTED,
                              lineHeight: "20px",
                            }}
                          >
                            Qty {line.quantity}
                            {meta ? ` · ${meta}` : ""}
                          </Text>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {currencyNote ? (
        <Text style={{ margin: "0 0 8px", fontFamily: FONT_BODY, fontSize: 13, color: EMAIL_MUTED }}>
          {currencyNote}
        </Text>
      ) : null}
      <EmailButton href={restoreUrl}>Return to your bag</EmailButton>
      <Text
        style={{
          margin: "16px 0 0",
          fontFamily: FONT_BODY,
          fontSize: 12,
          color: EMAIL_MUTED,
          lineHeight: "20px",
        }}
      >
        No code, no rush email after this. Open the link and the bag refills from what you chose.
      </Text>
    </EmailLayout>
  );
}
