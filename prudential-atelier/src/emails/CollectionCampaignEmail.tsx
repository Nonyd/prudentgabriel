import { Heading, Img, Link, Text } from "@react-email/components";
import EmailLayout from "@/emails/components/EmailLayout";
import EmailButton from "@/emails/components/EmailButton";
import { UNSUBSCRIBE_URL_PLACEHOLDER } from "@/lib/email-priority";

export type CampaignProduct = {
  name: string;
  slug: string;
  imageUrl: string | null;
  priceLabel: string;
};

type CollectionCampaignEmailProps = {
  heading: string;
  body1: string;
  body2?: string;
  heroUrl?: string | null;
  heroAlt?: string;
  products: CampaignProduct[];
  ctaLabel: string;
  ctaLink: string;
  shopBaseUrl: string;
  footerNote?: string;
  unsubscribeUrl?: string;
};

function paragraphLines(text: string) {
  return text.split("\n").filter((line) => line.length > 0);
}

export default function CollectionCampaignEmail({
  heading,
  body1,
  body2,
  heroUrl,
  heroAlt,
  products,
  ctaLabel,
  ctaLink,
  shopBaseUrl,
  footerNote,
  unsubscribeUrl = UNSUBSCRIBE_URL_PLACEHOLDER,
}: CollectionCampaignEmailProps) {
  return (
    <EmailLayout family="marketing" previewText={heading} unsubscribeUrl={unsubscribeUrl}>
      {heroUrl ? (
        <Img
          src={heroUrl}
          alt={heroAlt || heading}
          width={504}
          style={{
            width: "100%",
            maxWidth: 504,
            height: "auto",
            display: "block",
            margin: "0 0 24px",
            border: 0,
          }}
        />
      ) : null}
      <Heading
        as="h1"
        style={{
          margin: "0 0 16px",
          fontSize: 26,
          fontWeight: 400,
          color: "#442913",
          fontFamily: "Georgia, serif",
          lineHeight: 1.2,
        }}
      >
        {heading}
      </Heading>
      {paragraphLines(body1).map((line) => (
        <Text
          key={`b1-${line}`}
          style={{
            margin: "0 0 12px",
            fontSize: 15,
            lineHeight: 1.7,
            color: "#3D3D3A",
            fontFamily: "Georgia, serif",
          }}
        >
          {line}
        </Text>
      ))}
      {body2
        ? paragraphLines(body2).map((line) => (
            <Text
              key={`b2-${line}`}
              style={{
                margin: "0 0 12px",
                fontSize: 15,
                lineHeight: 1.7,
                color: "#3D3D3A",
                fontFamily: "Georgia, serif",
              }}
            >
              {line}
            </Text>
          ))
        : null}

      {products.length > 0 ? (
        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={{ margin: "24px 0" }}>
          <tbody>
            {products.map((p) => (
              <tr key={p.slug}>
                <td style={{ padding: "0 0 20px" }}>
                  <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
                    <tbody>
                      <tr>
                        <td width={120} valign="top" style={{ paddingRight: 16 }}>
                          {p.imageUrl ? (
                            <Img
                              src={p.imageUrl}
                              alt={p.name}
                              width={120}
                              height={160}
                              style={{ display: "block", border: 0, objectFit: "cover" }}
                            />
                          ) : (
                            <div style={{ width: 120, height: 160, backgroundColor: "#F2F2F0" }} />
                          )}
                        </td>
                        <td valign="top">
                          <Text
                            style={{
                              margin: "0 0 6px",
                              fontSize: 16,
                              color: "#442913",
                              fontFamily: "Georgia, serif",
                            }}
                          >
                            {p.name}
                          </Text>
                          <Text
                            style={{
                              margin: "0 0 10px",
                              fontSize: 14,
                              color: "#6B6B68",
                              fontFamily: "Georgia, serif",
                            }}
                          >
                            {p.priceLabel}
                          </Text>
                          <Link
                            href={`${shopBaseUrl}/shop/${p.slug}`}
                            style={{ fontSize: 12, color: "#442913", textDecoration: "underline" }}
                          >
                            View piece
                          </Link>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <EmailButton href={ctaLink}>{ctaLabel}</EmailButton>
      {footerNote ? (
        <Text
          style={{
            margin: "16px 0 0",
            fontSize: 12,
            lineHeight: 1.6,
            color: "#6B6B68",
            fontFamily: "Georgia, serif",
          }}
        >
          {footerNote}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
