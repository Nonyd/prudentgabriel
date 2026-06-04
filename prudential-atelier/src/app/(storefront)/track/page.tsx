import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { TrackSearchForm } from "@/components/track/TrackSearchForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Tracking — Prudential Atelier",
  description: "Track your bespoke commission with your order reference.",
};

type Props = {
  searchParams: Promise<{ ref?: string }>;
};

export default async function TrackLandingPage({ searchParams }: Props) {
  const { ref } = await searchParams;

  if (ref?.trim()) {
    const order = await prisma.bespokeOrder.findFirst({
      where: { orderRef: { equals: ref.trim(), mode: "insensitive" } },
      select: { trackingToken: true },
    });
    if (order) redirect(`/track/${order.trackingToken}`);
    return <TrackSearchForm notFound />;
  }

  return <TrackSearchForm />;
}
