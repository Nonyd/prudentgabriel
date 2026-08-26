import { z } from "zod";

export const collectionAdminSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(2000).optional(),
  excerpt: z.string().max(200).optional(),
  coverImage: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  coverImageAlt: z.string().max(200).optional(),
  autoTag: z.string().max(50).optional().nullable(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  season: z.string().max(10).optional().nullable(),
  year: z.number().int().min(2000).max(2100).optional().nullable(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
});

export const collectionAdminPatchSchema = collectionAdminSchema.partial().extend({
  /** Required when unpublishing would hide products. Not stored on Collection. */
  confirmUnpublishProducts: z.boolean().optional(),
});
