import {
  formatReceivedNGN,
  joinNamedList,
  type CascadeActorSnap,
  type CascadeDialogCopy,
  type CascadePaymentSnap,
} from "@/lib/cascade-copy";

/**
 * Deleting clients from the Clients list: the client profile, her account and
 * everything that hangs off either — commissions (as the commission cascade
 * deletes them), consultations, shop orders, quotations, invoices and every
 * payment. Counted in the warning first; the typed DELETE is asked whenever
 * anything beyond the bare profile goes; the activity log keeps the counts and
 * payment references under the account that did it — never a note's words.
 *
 * Client-safe (no Prisma): the list page builds its dialog from this.
 */
export const CLIENT_CASCADE_RECORD_TYPE = "CLIENT_CASCADE";
export const CLIENT_CASCADE_MODULE = "clients";
export const MAX_CLIENT_CASCADE = 50;

export type ClientCascadeCounts = {
  commissions: number;
  /** Of which still in progress (not delivered or cancelled). */
  activeCommissions: number;
  consultations: number;
  shopOrders: number;
  payments: number;
  quotations: number;
  invoices: number;
  notes: number;
  costSheets: number;
  bespokeRequests: number;
  enquiries: number;
  reviews: number;
  testimonials: number;
  pointsEntries: number;
  measurements: number;
  moodboards: number;
  eventDates: number;
  clientNotes: number;
  addresses: number;
  wishlist: number;
  cartItems: number;
  savedCards: number;
  chats: number;
  checkoutSessions: number;
};

export type ClientCascadeItem = {
  clientProfileId: string;
  userId: string;
  name: string;
  email: string;
  counts: ClientCascadeCounts;
  commissionRefs: string[];
  orderNumbers: string[];
  bookingNumbers: string[];
  payments: CascadePaymentSnap[];
  /** Confirmed cash received (points excluded), across every payment that goes. */
  receivedNGN: number;
  /** Something beyond the bare profile goes: the typed confirmation is asked. */
  loud: boolean;
  /** Payments go with it: Super Admin only. */
  superAdminOnly: boolean;
  blocked: boolean;
  blockReason: string | null;
};

export type ClientCascadePreview = {
  clients: ClientCascadeItem[];
  /** Ids that matched no client profile. */
  missingIds: string[];
  deletableCount: number;
  blockedCount: number;
  loud: boolean;
  superAdminOnly: boolean;
  receivedNGN: number;
};

export type ClientCascadeSnapshot = {
  kind: typeof CLIENT_CASCADE_RECORD_TYPE;
  clientProfileId: string;
  userId: string;
  clientName: string;
  clientEmail: string;
  counts: ClientCascadeCounts;
  commissionRefs: string[];
  orderNumbers: string[];
  bookingNumbers: string[];
  payments: CascadePaymentSnap[];
  receivedNGN: number;
  actor: CascadeActorSnap;
};

export type ClientCascadeResult = {
  clientProfileId: string;
  name: string;
  ok: boolean;
  logId?: string;
  error?: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 commissions (1 in progress), 3 payments (₦450,000 received), 1 consultation" — what goes with one client. */
export function clientCountsSummary(c: ClientCascadeCounts, receivedNGN: number): string[] {
  const parts: string[] = [];
  if (c.commissions) {
    parts.push(
      `${plural(c.commissions, "commission", "commissions")}${c.activeCommissions ? ` (${c.activeCommissions} in progress)` : ""}`,
    );
  }
  if (c.payments) parts.push(`${plural(c.payments, "payment", "payments")} (${formatReceivedNGN(receivedNGN)} received)`);
  if (c.consultations) parts.push(plural(c.consultations, "consultation", "consultations"));
  if (c.shopOrders) parts.push(plural(c.shopOrders, "shop order", "shop orders"));
  if (c.quotations) parts.push(plural(c.quotations, "quotation", "quotations"));
  if (c.invoices) parts.push(plural(c.invoices, "invoice", "invoices"));
  if (c.notes) parts.push(plural(c.notes, "note", "notes"));
  if (c.costSheets) parts.push(plural(c.costSheets, "cost sheet", "cost sheets"));
  if (c.bespokeRequests) parts.push(plural(c.bespokeRequests, "bespoke request", "bespoke requests"));
  if (c.enquiries) parts.push(plural(c.enquiries, "enquiry", "enquiries"));
  if (c.measurements) parts.push("measurements");
  if (c.moodboards) parts.push(plural(c.moodboards, "moodboard", "moodboards"));
  if (c.eventDates) parts.push(plural(c.eventDates, "event date", "event dates"));
  if (c.clientNotes) parts.push(plural(c.clientNotes, "client note", "client notes"));
  if (c.pointsEntries) parts.push(plural(c.pointsEntries, "points entry", "points entries"));
  if (c.reviews) parts.push(plural(c.reviews, "review", "reviews"));
  if (c.testimonials) parts.push(plural(c.testimonials, "testimonial", "testimonials"));
  if (c.addresses) parts.push(plural(c.addresses, "address", "addresses"));
  if (c.wishlist) parts.push(plural(c.wishlist, "wishlist item", "wishlist items"));
  if (c.cartItems) parts.push(plural(c.cartItems, "cart item", "cart items"));
  if (c.savedCards) parts.push(plural(c.savedCards, "saved card", "saved cards"));
  if (c.chats) parts.push(plural(c.chats, "chat", "chats"));
  return parts;
}

/** Description line for the activity log row of one deleted client. */
export function clientCascadeDescription(item: ClientCascadeItem): string {
  const parts = clientCountsSummary(item.counts, item.receivedNGN);
  const who = item.name && item.name !== item.email ? `${item.name} (${item.email})` : item.email;
  return parts.length
    ? `Deleted client ${who}: ${parts.join(", ")}, and her account.`
    : `Deleted client ${who}: profile and account only.`;
}

/** The warning shown before anything is deleted. */
export function clientDialogCopy(p: ClientCascadePreview, actorEmail?: string | null): CascadeDialogCopy {
  const deletable = p.clients.filter((c) => !c.blocked);
  const blocked = p.clients.filter((c) => c.blocked);

  if (deletable.length === 0) {
    return {
      title: blocked.length === 1 ? `Cannot delete ${blocked[0].name}` : "Cannot delete these clients",
      heading:
        blocked.length === 0
          ? "None of the selected clients could be found."
          : blocked.length === 1
            ? (blocked[0].blockReason ?? "This client cannot be deleted.")
            : `None of the ${blocked.length} selected clients can be deleted.`,
      lines: blocked.length > 1 ? blocked.map((c) => `· ${c.name}: ${c.blockReason ?? "cannot be deleted"}`) : [],
      loud: false,
      blocked: true,
    };
  }

  const heading =
    deletable.length === 1
      ? `${deletable[0].name} will be deleted, with her account.`
      : `${deletable.length} clients will be deleted, with their accounts.`;
  const lines: string[] = [];
  for (const c of deletable) {
    const parts = clientCountsSummary(c.counts, c.receivedNGN);
    lines.push(`· ${c.name} — ${parts.length ? parts.join(", ") : "profile only"}`);
    if (c.payments.length) {
      lines.push(`  Payments: ${joinNamedList(c.payments.map((x) => x.reference))}`);
    }
  }
  if (blocked.length) {
    lines.push(`Kept (cannot be deleted):`);
    for (const c of blocked) lines.push(`· ${c.name}: ${c.blockReason ?? "cannot be deleted"}`);
  }
  if (p.missingIds.length) lines.push(`${plural(p.missingIds.length, "selected client was", "selected clients were")} not found.`);
  if (p.superAdminOnly) lines.push("Payments go with it: only a Super Admin can do this.");
  lines.push(
    actorEmail
      ? `This is permanent and is recorded in the activity log under ${actorEmail}.`
      : "This is permanent and is recorded in the activity log under your account.",
  );

  const loud = deletable.some((c) => c.loud);
  return {
    title:
      deletable.length === 1
        ? `Delete client — ${deletable[0].name}`
        : `Delete ${deletable.length} clients`,
    heading,
    lines,
    loud,
  };
}
