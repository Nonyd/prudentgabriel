import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { notifyStaffOrderUpdate } from "@/lib/staff-notifications";
import {
  NOTE_SECTION_LABELS,
  isNoteSection,
  type Anchor,
  type NoteInput,
  type NoteRow,
} from "@/lib/atelier/commission-notes-shared";

export * from "@/lib/atelier/commission-notes-shared";

/**
 * Slice BD2 — notes that do not destroy what they replace.
 *
 * "Subsequent client changes and call summaries can be added as timestamped
 * notes without altering historical consultation records." A note is a row with
 * its author, its time and the part of the file it belongs to. It is never
 * edited (a database trigger refuses UPDATE and DELETE): a correction is a new
 * row pointing at the one it supersedes, and both stay on the page.
 *
 * Two anchors, one stream: the consultation (what she said on the day) and the
 * commission (the brief the workroom works to). The records they sit under —
 * session notes, reference images, the moodboard, the brief — are not touched.
 */

const noteSelect = {
  id: true,
  section: true,
  body: true,
  authorName: true,
  createdAt: true,
  supersedesId: true,
  orderId: true,
  correctedBy: { select: { id: true } },
} as const;

type NoteSource = {
  id: string;
  section: string;
  body: string;
  authorName: string | null;
  createdAt: Date;
  supersedesId: string | null;
  orderId: string | null;
  correctedBy: { id: string } | null;
};

function toRow(n: NoteSource): NoteRow {
  const section = isNoteSection(n.section) ? n.section : "brief";
  return {
    id: n.id,
    section,
    sectionLabel: NOTE_SECTION_LABELS[section],
    body: n.body,
    authorName: n.authorName ?? "The house",
    createdAt: n.createdAt.toISOString(),
    supersedesId: n.supersedesId,
    correctedById: n.correctedBy?.id ?? null,
    anchor: n.orderId ? "commission" : "consultation",
  };
}

/**
 * Notes for a commission: its own, and those on the consultation it came from,
 * oldest first so the story reads in order.
 */
export async function listCommissionNotes(orderId: string): Promise<NoteRow[]> {
  const order = await prisma.bespokeOrder.findUnique({ where: { id: orderId }, select: { consultationId: true } });
  if (!order) return [];
  const rows = await prisma.commissionNote.findMany({
    where: {
      OR: [{ orderId }, ...(order.consultationId ? [{ consultationId: order.consultationId, orderId: null }] : [])],
    },
    orderBy: { createdAt: "asc" },
    select: noteSelect,
  });
  return rows.map(toRow);
}

export async function listConsultationNotes(consultationId: string): Promise<NoteRow[]> {
  const rows = await prisma.commissionNote.findMany({
    where: { consultationId },
    orderBy: { createdAt: "asc" },
    select: noteSelect,
  });
  return rows.map(toRow);
}

type Author = { id: string; name: string | null; email: string | null };

/**
 * Append a note. A correction must sit under the same anchor as the note it
 * corrects, and a note can be corrected once (correct the correction instead).
 */
export async function addNote(
  anchor: Anchor,
  input: NoteInput,
  author: Author,
): Promise<{ ok: true; note: NoteRow } | { ok: false; status: 400 | 404 | 409; error: string }> {
  const orderId = "orderId" in anchor ? anchor.orderId : null;
  const consultationId = "consultationId" in anchor ? anchor.consultationId : null;

  const owner = orderId
    ? await prisma.bespokeOrder.findUnique({ where: { id: orderId }, select: { id: true, orderRef: true, consultationId: true } })
    : await prisma.consultationBooking.findUnique({ where: { id: consultationId! }, select: { id: true, bookingNumber: true } });
  if (!owner) return { ok: false, status: 404, error: "Not found" };

  if (input.supersedesId) {
    const prior = await prisma.commissionNote.findUnique({
      where: { id: input.supersedesId },
      select: { orderId: true, consultationId: true, correctedBy: { select: { id: true } } },
    });
    const sameAnchor =
      prior &&
      (orderId
        ? prior.orderId === orderId ||
          (prior.orderId === null && prior.consultationId === (owner as { consultationId?: string | null }).consultationId)
        : prior.consultationId === consultationId);
    if (!prior || !sameAnchor) return { ok: false, status: 400, error: "That note is not on this file." };
    if (prior.correctedBy) return { ok: false, status: 409, error: "That note has already been corrected." };
  }

  const authorName = author.name?.trim() || author.email || "The house";
  const created = await prisma.commissionNote.create({
    data: {
      orderId,
      consultationId,
      section: input.section,
      body: input.body,
      authorId: author.id,
      authorName,
      supersedesId: input.supersedesId,
    },
    select: noteSelect,
  });

  await notifyNote(anchor, owner, input, authorName);
  return { ok: true, note: toRow(created) };
}

/** Everyone working the file hears about it (12 October: "all team members logged in"). */
async function notifyNote(
  anchor: Anchor,
  owner: { id: string; orderRef?: string; bookingNumber?: string },
  input: NoteInput,
  authorName: string,
) {
  const what = input.supersedesId ? "corrected a note" : "added a note";
  const where = NOTE_SECTION_LABELS[input.section];
  const preview = input.body.length > 140 ? `${input.body.slice(0, 140)}…` : input.body;
  if ("orderId" in anchor) {
    const ref = owner.orderRef ?? "";
    await createNotification({
      type: "NEW_BESPOKE",
      title: `${authorName} ${what} on ${ref}`,
      message: `${where}: ${preview}`,
      link: `/admin/bespoke/${anchor.orderId}`,
      entityId: anchor.orderId,
    }).catch(() => {});
    const assigned = await prisma.orderAssignment.findMany({
      where: { orderId: anchor.orderId },
      select: { staffProfile: { select: { userId: true } } },
    });
    for (const userId of new Set(assigned.map((a) => a.staffProfile.userId))) {
      notifyStaffOrderUpdate({
        userId,
        orderId: anchor.orderId,
        orderRef: ref,
        title: `New note on ${ref}`,
        message: `${where}: ${preview}`,
      });
    }
  } else {
    await createNotification({
      type: "NEW_CONSULTATION",
      title: `${authorName} ${what} on consultation ${owner.bookingNumber ?? ""}`,
      message: `${where}: ${preview}`,
      link: `/admin/consultations/${anchor.consultationId}`,
      entityId: anchor.consultationId,
    }).catch(() => {});
  }
}
