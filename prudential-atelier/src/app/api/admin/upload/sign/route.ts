import { NextRequest, NextResponse } from "next/server";
import { sanitizeUploadFolder } from "@/lib/admin-upload-folder";
import { gateUploadFolder } from "@/lib/media/gate-upload";

/**
 * Direct-to-Cloudinary signing is retired. Videos go through POST /api/admin/upload
 * with allowVideo=true (VPS has no Vercel body cap).
 */
export async function POST(req: NextRequest) {
  let body: { folder?: string } = {};
  try {
    body = (await req.json()) as { folder?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const folder = sanitizeUploadFolder(body.folder, "prudential-atelier/uploads");
  const gate = await gateUploadFolder(folder);
  if (!gate.ok) return gate.response;

  return NextResponse.json({
    configured: false,
    error: "Direct Cloudinary upload is no longer used. POST the file to /api/admin/upload.",
  });
}
