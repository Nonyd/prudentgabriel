import { z } from "zod";
import { optionalStoredPublicMediaUrlSchema } from "@/lib/media/stored-url";

export const adminTestimonialBodySchema = z
  .object({
    userId: z.string().optional().nullable(),
    displayName: z.string().min(2).max(120).optional().nullable(),
    location: z.string().max(120).optional().nullable(),
    body: z.string().min(30).max(600),
    rating: z.number().int().min(1).max(5),
    adminImage: optionalStoredPublicMediaUrlSchema,
    productContext: z.string().max(200).optional().nullable(),
    orderContext: z.string().max(200).optional().nullable(),
    isApproved: z.boolean(),
    showOnHomepage: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const hasUser = Boolean(data.userId?.trim());
    const hasDisplayName = Boolean(data.displayName?.trim());

    if (hasUser && hasDisplayName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either a linked client or a display name, not both",
        path: ["displayName"],
      });
    }

    if (!hasUser && !hasDisplayName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a client or enter a display name",
        path: ["displayName"],
      });
    }

    if (data.showOnHomepage && !data.isApproved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only approved testimonials can appear on the homepage",
        path: ["showOnHomepage"],
      });
    }
  });

export type AdminTestimonialBody = z.infer<typeof adminTestimonialBodySchema>;

export function toTestimonialWriteData(data: AdminTestimonialBody) {
  const userId = data.userId?.trim() || null;
  return {
    userId,
    displayName: userId ? null : (data.displayName?.trim() || null),
    location: userId ? null : (data.location?.trim() || null),
    body: data.body.trim(),
    rating: data.rating,
    adminImage: data.adminImage ?? null,
    productContext: data.productContext?.trim() || null,
    orderContext: data.orderContext?.trim() || null,
    isApproved: data.isApproved,
    showOnHomepage: data.isApproved ? data.showOnHomepage : false,
  };
}
