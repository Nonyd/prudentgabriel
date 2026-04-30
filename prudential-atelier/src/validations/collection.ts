import { z } from "zod";

const optionalUrl = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : v),
  z.union([z.string().url(), z.null()]).optional(),
);

export const collectionAdminSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(2000).optional(),
  excerpt: z.string().max(200).optional(),
  coverImage: optionalUrl,
  coverImageAlt: z.string().max(200).optional(),
  autoTag: z.string().max(50).optional().nullable(),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
  season: z.string().max(10).optional().nullable(),
  year: z.number().int().min(2000).max(2100).optional().nullable(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
});

export const collectionAdminPatchSchema = collectionAdminSchema.partial();
