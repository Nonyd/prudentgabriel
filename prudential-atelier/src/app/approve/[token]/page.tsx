import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicStageApprovalClient } from "@/components/public/PublicStageApprovalClient";
import { loadPublicStageApproval } from "@/lib/public-stage-approval-payload";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Review your commission | Prudential Atelier",
    robots: { index: false, follow: false },
  };
}

export default async function PublicStageApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await loadPublicStageApproval(token);
  if (!view) notFound();

  return <PublicStageApprovalClient token={token} view={view} />;
}
