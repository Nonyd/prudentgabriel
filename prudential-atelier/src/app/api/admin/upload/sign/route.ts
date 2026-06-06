import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { cloudinary } from "@/lib/cloudinary";

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80&auto=format";

function sanitizeFolder(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "prudential-atelier/uploads";
  return raw.replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 120);
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const configured =
    Boolean(process.env.CLOUDINARY_API_KEY?.length) &&
    Boolean(process.env.CLOUDINARY_API_SECRET?.length) &&
    Boolean(process.env.CLOUDINARY_CLOUD_NAME?.length);

  let body: { folder?: string; resourceType?: string } = {};
  try {
    body = (await req.json()) as { folder?: string; resourceType?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const folder = sanitizeFolder(body.folder);
  const resourceType = body.resourceType === "video" ? "video" : "image";

  if (!configured) {
    return NextResponse.json({
      configured: false,
      devUrl:
        resourceType === "video"
          ? "https://res.cloudinary.com/demo/video/upload/sample.mp4"
          : PLACEHOLDER,
    });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, folder };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!,
  );

  return NextResponse.json({
    configured: true,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder,
    resourceType,
  });
}
