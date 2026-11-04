import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { logActivity } from "@/lib/logger";

type Params = { params: Promise<{ clientId: string }> };

const bodySchema = z.object({ url: z.string().trim().min(1).max(2000) });

const without = (list: string[], url: string) => list.filter((u) => u !== url);

/**
 * Take one picture off a client's file: a sketch, a step's photo, a mood board
 * picture (hers, the session's or the house's). Admins only. The picture is
 * taken off every record of hers that holds it, so it does not come back from
 * another source; a house mood board left with no pictures goes too. The file
 * itself is kept in storage (an email already sent may still show it).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { clientId } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Which picture?" }, { status: 400 });
  const { url } = parsed.data;

  const client = await prisma.clientProfile.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orders = await prisma.bespokeOrder.findMany({
    where: { clientProfileId: clientId },
    select: {
      id: true,
      orderRef: true,
      moodboardImages: true,
      consultation: {
        select: {
          id: true,
          referenceImages: true,
          moodboardImages: true,
          enquiry: { select: { id: true, moodboardImages: true } },
        },
      },
    },
  });
  const orderIds = orders.map((o) => o.id);
  const boards = await prisma.moodboard.findMany({
    where: { clientId, images: { has: url } },
    select: { id: true, images: true },
  });
  const updates = await prisma.stageUpdate.findMany({
    where: { orderId: { in: orderIds }, OR: [{ images: { has: url } }, { videos: { has: url } }] },
    select: { id: true, images: true, videos: true },
  });

  let removed = 0;
  await prisma.$transaction(async (tx) => {
    const media = await tx.orderStageMedia.deleteMany({ where: { orderId: { in: orderIds }, url } });
    removed += media.count;
    for (const u of updates) {
      await tx.stageUpdate.update({
        where: { id: u.id },
        data: { images: without(u.images, url), videos: without(u.videos, url) },
      });
      removed++;
    }
    for (const o of orders) {
      if (o.moodboardImages.includes(url)) {
        await tx.bespokeOrder.update({ where: { id: o.id }, data: { moodboardImages: without(o.moodboardImages, url) } });
        removed++;
      }
      const c = o.consultation;
      if (c && (c.referenceImages.includes(url) || c.moodboardImages.includes(url))) {
        await tx.consultationBooking.update({
          where: { id: c.id },
          data: { referenceImages: without(c.referenceImages, url), moodboardImages: without(c.moodboardImages, url) },
        });
        removed++;
      }
      const e = c?.enquiry;
      if (e && e.moodboardImages.includes(url)) {
        await tx.consultationEnquiry.update({ where: { id: e.id }, data: { moodboardImages: without(e.moodboardImages, url) } });
        removed++;
      }
    }
    for (const b of boards) {
      const rest = without(b.images, url);
      if (rest.length) await tx.moodboard.update({ where: { id: b.id }, data: { images: rest } });
      else await tx.moodboard.delete({ where: { id: b.id } });
      removed++;
    }
  });

  if (!removed) return NextResponse.json({ error: "That picture is not on this client's file." }, { status: 404 });

  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role ?? undefined,
    action: "DELETE",
    module: "clients",
    description: `Removed a picture from the client file (${orders.map((o) => o.orderRef).join(", ") || "no commission"}): ${url}`,
    recordId: clientId,
    recordType: "ClientProfile",
  });

  return NextResponse.json({ ok: true });
}
