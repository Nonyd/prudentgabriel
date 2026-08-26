import { Heading, Text } from "@react-email/components";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailLayout from "./components/EmailLayout";
import EmailButton from "./components/EmailButton";

const APP = getPublicAppUrl();

type BackInStockEmailProps = {
  productName: string;
  size: string;
  productSlug: string;
  priceNGN: number;
};

export default function BackInStockEmail({ productName, size, productSlug, priceNGN }: BackInStockEmailProps) {
  return (
    <EmailLayout family="marketing" previewText={`${productName} is back in stock`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        {productName} is back in stock!
      </Heading>
      <Text style={{ fontSize: 16, color: "#2d2d2d" }}>The piece you were waiting for is available again.</Text>
      <Text style={{ fontSize: 15, color: "#444" }}>
        {productName} · Size: {size} · ₦{Math.round(priceNGN).toLocaleString("en-NG")}
      </Text>
      <Text style={{ fontSize: 14, color: "#442913" }}>Limited stock — act fast.</Text>
      <EmailButton href={`${APP}/shop/${productSlug}`}>Shop now</EmailButton>
    </EmailLayout>
  );
}
