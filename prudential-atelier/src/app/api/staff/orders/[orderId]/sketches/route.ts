import { NextRequest, NextResponse } from "next/server";
import { StageMediaKind } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMediaStore } from "@/lib/media";
import { mimeFromMagicBytes } from "@/lib/image-upload-mime";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { logServerError } from "@/lib/logger";
import { folderIsPrivate } from "@/lib/admin-upload-folder";
import { resolveStaffPortalUser } from "@/lib/staff-view-as";
import { creativeAccessFor } from "@/lib/creative-team";
import { addStageMedia } from "@/lib/atelier/stage-actions";

type Params = { params: Promise<{ orderId: string }> };

const MAX_BYTES = 10 * 1024 * 1024;
const FOLDER = "bespoke-stages";

function isFileLike(v: unknown): v is Blob & { name?: string } {
  return typeof v === "object" && v !== null && typeof (v as Blob).arrayBuffer === "function";
}

/**
 * The Illustrator adds a sketch or design picture to an order (11 November 2026).
 * It is filed on the order's Sketching step, where the house's own sketches go,
 * so it shows under Illustrations in the client file. Nothing else is writable
 * for the Creative Team, and never while the Super Admin is viewing as someone.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = await resolveStaffPortalUser(session);
  if (!viewer || viewer.viewingAs) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const access = await creativeAccessFor(viewer.id);
  if (!access.illustrator) {
    return NextResponse.json({ error: "Adding sketches is for the Illustrator." }, { status: 403 });
  }

  const limited = await rateLimitOr429(req, "staff-sketch-upload", 40, 15 * 60 * 1000);
  if (limited) return limited;

  const { orderId } = await params;
  const step = await prisma.orderStage.findFirst({
    where: { orderId, stage: "SKETCHING_CONCEPT" },
    orderBy: { position: "asc" },
    select: { id: true, stage: true },
  });
  if (!step) {
    const exists = await prisma.bespokeOrder.findUnique({ where: { id: orderId }, select: { id: true } });
    return exists
      ? NextResponse.json({ error: "This order has no Sketching step to file the sketch under." }, { status: 400 })
      : NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const raw = form.get("file");
  if (!isFileLike(raw)) return NextResponse.json({ error: "Choose a picture" }, { status: 400 });
  if (raw.size > MAX_BYTES) return NextResponse.json({ error: "A picture must be 10MB or smaller" }, { status: 400 });

  const buffer = Buffer.from(await raw.arrayBuffer());
  const mime = mimeFromMagicBytes(buffer);
  if (!mime || mime === "application/pdf") {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP pictures" }, { status: 400 });
  }

  try {
    const stored = await getMediaStore().put(buffer, {
      folder: FOLDER,
      originalName: typeof raw.name === "string" ? raw.name : undefined,
      mime,
      private: folderIsPrivate(FOLDER),
    });
    await addStageMedia({ orderId, step, urls: [stored.url], kind: StageMediaKind.IMAGE, uploadedById: viewer.id });
    return NextResponse.json({ url: stored.url });
  } catch (e) {
    await logServerError({ errorType: "STAFF_SKETCH_UPLOAD", error: e });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
