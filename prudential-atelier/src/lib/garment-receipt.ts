import { z } from "zod";
import { resolveDestinationBand } from "@/lib/shipping/destination";

/**
 * How an atelier client receives the finished piece, asked when she books and pays
 * for the consultation. In Lagos: our office or her address. Elsewhere in Nigeria:
 * the courier's dispatch office in her city or her house. Abroad: her address.
 */
export const GARMENT_RECEIPT_MODES = ["OFFICE_PICKUP", "DISPATCH_PICKUP", "DELIVERY"] as const;
export type GarmentReceiptMode = (typeof GARMENT_RECEIPT_MODES)[number];

export const garmentReceiptSchema = z
  .object({
    mode: z.enum(GARMENT_RECEIPT_MODES),
    country: z.string().trim().length(2),
    state: z.string().trim().min(1).max(80),
    city: z.string().trim().max(80).optional(),
    address: z.string().trim().max(300).optional(),
    dispatchOffice: z.string().trim().max(160).optional(),
  })
  .superRefine((v, ctx) => {
    const band = resolveDestinationBand(v);
    const allowed = modesFor(band);
    if (!allowed.includes(v.mode)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mode"], message: "That option is not offered for this location." });
    }
    if (v.mode === "DELIVERY" && (v.address ?? "").length < 5) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["address"], message: "Enter the house address for delivery." });
    }
    if (v.mode !== "OFFICE_PICKUP" && !(v.city ?? "").trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["city"], message: "Enter your city." });
    }
    if (v.mode === "DISPATCH_PICKUP" && (v.dispatchOffice ?? "").length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dispatchOffice"], message: "Name the dispatch office." });
    }
  });

export type GarmentReceipt = z.infer<typeof garmentReceiptSchema>;

export function modesFor(band: ReturnType<typeof resolveDestinationBand>): GarmentReceiptMode[] {
  if (band === "LAGOS") return ["OFFICE_PICKUP", "DELIVERY"];
  if (band === "NIGERIA") return ["DISPATCH_PICKUP", "DELIVERY"];
  return ["DELIVERY"];
}

export const GARMENT_RECEIPT_LABEL: Record<GarmentReceiptMode, string> = {
  OFFICE_PICKUP: "Pick up at our office",
  DISPATCH_PICKUP: "Pick up at the dispatch office",
  DELIVERY: "Delivery to her address",
};

/** One readable block for admin screens. Null when nothing was recorded. */
export function describeGarmentReceipt(raw: unknown): { label: string; lines: string[] } | null {
  const parsed = garmentReceiptSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  const place = [r.city, r.state, r.country].filter(Boolean).join(", ");
  const lines =
    r.mode === "DELIVERY"
      ? [r.address ?? "", place]
      : r.mode === "DISPATCH_PICKUP"
        ? [r.dispatchOffice ?? "", place]
        : [place];
  return { label: GARMENT_RECEIPT_LABEL[r.mode], lines: lines.filter((l) => l.trim()) };
}
