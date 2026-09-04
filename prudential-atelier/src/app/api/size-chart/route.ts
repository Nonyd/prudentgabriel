import { NextResponse } from "next/server";
import { getCMSContent } from "@/lib/cms";
import { cmsJson } from "@/lib/cms-helpers";
import { getHouseSizeChart } from "@/lib/custom-context";
import { DEFAULT_WOMEN_SIZE_CHART } from "@/lib/page-content-defaults";
import { womenCmsToChartRows } from "@/lib/sizing";

export const revalidate = 300;

export async function GET() {
  try {
    const chart = await getHouseSizeChart();
    const prismaRows = (chart?.rows ?? []).map((r) => ({
      label: r.label,
      bustCm: r.bustCm,
      waistCm: r.waistCm,
      hipCm: r.hipCm,
      lengthCm: r.lengthCm,
    }));
    if (prismaRows.length > 0) {
      return NextResponse.json({ name: chart?.name ?? "Women", rows: prismaRows });
    }
    const cms = await getCMSContent(["size_guide_women"]);
    const women = cmsJson(cms, "size_guide_women", DEFAULT_WOMEN_SIZE_CHART);
    return NextResponse.json({ name: "Women", rows: womenCmsToChartRows(women) });
  } catch (e) {
    console.warn("[size-chart]", e);
    return NextResponse.json({ name: "Women", rows: [] });
  }
}
