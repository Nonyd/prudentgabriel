import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { TrackSearchForm } from "@/components/track/TrackSearchForm";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { tokenRouteMetadata } from "@/lib/seo";
import { ensureTrackingRaw } from "@/lib/capability-token-lookup";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...tokenRouteMetadata("Order tracking"),
};

type Props = {
  searchParams: Promise<{ ref?: string }>;
};

export default async function TrackLandingPage({ searchParams }: Props) {
  const { ref } = await searchParams;
  const cms = await getCMSContent(["track_page_eyebrow", "track_page_title", "track_page_subtitle"]);
  const trackProps = {
    eyebrow: cmsGet(cms, "track_page_eyebrow", "ORDER TRACKING"),
    title: cmsGet(cms, "track_page_title", "Follow your commission"),
    subtitle: cmsGet(cms, "track_page_subtitle", "No login required — just your order reference."),
  };

  if (ref?.trim()) {
    const h = await headers();
    const ip = clientIpFromHeaders(h);
    const limited = await checkRateLimit(`track-ref:${ip}`, 20, 15 * 60 * 1000);
    if (!limited.ok) {
      return <TrackSearchForm notFound {...trackProps} />;
    }
    const order = await prisma.bespokeOrder.findFirst({
      where: { orderRef: { equals: ref.trim(), mode: "insensitive" } },
      select: {
        id: true,
        trackingToken: true,
        trackingTokenEnc: true,
        trackingTokenExpiresAt: true,
      },
    });
    if (order) {
      const raw = await ensureTrackingRaw(order);
      redirect(`/track/${raw}`);
    }
    return <TrackSearchForm notFound {...trackProps} />;
  }

  return <TrackSearchForm {...trackProps} />;
}
