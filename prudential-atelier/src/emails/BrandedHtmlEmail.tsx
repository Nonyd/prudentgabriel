import EmailLayout from "@/emails/components/EmailLayout";

type BrandedHtmlEmailProps = {
  previewText: string;
  bodyHtml: string;
};

export default function BrandedHtmlEmail({ previewText, bodyHtml }: BrandedHtmlEmailProps) {
  return (
    <EmailLayout previewText={previewText}>
      <div
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
        style={{ fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.7, color: "#3D3D3A" }}
      />
    </EmailLayout>
  );
}
