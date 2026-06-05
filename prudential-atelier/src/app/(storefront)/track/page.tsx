import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { TrackSearchForm } from "@/components/track/TrackSearchForm";
import { cmsGet, getCMSContent } from "@/lib/cms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Tracking — Prudential Atelier",
  description: "Track your atelier commission with your order reference.",
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
    const order = await prisma.bespokeOrder.findFirst({
      where: { orderRef: { equals: ref.trim(), mode: "insensitive" } },
      select: { trackingToken: true },
    });
    if (order) redirect(`/track/${order.trackingToken}`);
    return <TrackSearchForm notFound {...trackProps} />;
  }

  return <TrackSearchForm {...trackProps} />;
}
