import type { Metadata } from "next";
import { TrackSearchForm } from "@/components/track/TrackSearchForm";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { tokenRouteMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...tokenRouteMetadata("Order tracking"),
};

type Props = {
  searchParams: Promise<{ ref?: string }>;
};

/**
 * Token sweep: `?ref=` only fills the form now. A reference is four digits; on
 * its own it no longer opens anything (POST /api/track/lookup needs the email too).
 */
export default async function TrackLandingPage({ searchParams }: Props) {
  const { ref } = await searchParams;
  const cms = await getCMSContent(["track_page_eyebrow", "track_page_title", "track_page_subtitle"]);
  return (
    <TrackSearchForm
      initialRef={ref?.trim().slice(0, 40) ?? ""}
      eyebrow={cmsGet(cms, "track_page_eyebrow", "ORDER TRACKING")}
      title={cmsGet(cms, "track_page_title", "Follow your commission")}
      subtitle={cmsGet(cms, "track_page_subtitle", "No login required — your order reference and the email on the order.")}
    />
  );
}
