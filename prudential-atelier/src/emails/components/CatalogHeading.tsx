import { Heading, Text } from "@react-email/components";

const headingStyle = {
  fontSize: 28,
  fontWeight: 400,
  color: "#442913",
  margin: "0 0 12px",
} as const;

const bodyStyle = {
  fontSize: 16,
  color: "#2d2d2d",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap" as const,
};

export function CatalogHeading({
  heading,
  body,
  fallbackHeading,
  fallbackBody,
}: {
  heading?: string;
  body?: string;
  fallbackHeading: string;
  fallbackBody?: string;
}) {
  const title = heading?.trim() || fallbackHeading;
  const intro = body?.trim() || fallbackBody;
  return (
    <>
      <Heading as="h1" style={headingStyle}>
        {title}
      </Heading>
      {intro ? <Text style={bodyStyle}>{intro}</Text> : null}
    </>
  );
}
