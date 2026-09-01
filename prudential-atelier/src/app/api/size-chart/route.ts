import { NextResponse } from "next/server";
import { getHouseSizeChart } from "@/lib/custom-context";

export const revalidate = 300;

export async function GET() {
  try {
    const chart = await getHouseSizeChart();
    return NextResponse.json({
      name: chart?.name ?? "Women",
      rows: (chart?.rows ?? []).map((r) => ({
        label: r.label,
        bustCm: r.bustCm,
        waistCm: r.waistCm,
        hipCm: r.hipCm,
        lengthCm: r.lengthCm,
      })),
    });
  } catch (e) {
    console.warn("[size-chart]", e);
    return NextResponse.json({ name: "Women", rows: [] });
  }
}
