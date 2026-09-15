import { ProductType } from "@prisma/client";
import { z } from "zod";
import { optionalStoredPublicMediaUrlSchema, storedPublicMediaUrlSchema } from "@/lib/media/stored-url";
import { missingPublishNeeds } from "@/lib/product-wizard";

function optNonNegNumber() {
  return z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return undefined;
    return n;
  }, z.number().min(0).optional());
}

const variantSchema = z.object({
  id: z.string().optional(),
  size: z.string().min(1),
  sku: z.string().optional().default(""),
  skuManual: z.boolean().optional().default(false),
  priceNGN: z.coerce.number().min(0),
  priceUSD: optNonNegNumber(),
  priceGBP: optNonNegNumber(),
  salePriceNGN: z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    return n;
  }, z.number().min(0).nullable().optional()),
  sortOrder: z.coerce.number().int().default(0),
  weightKg: optNonNegNumber(),
  lengthCm: optNonNegNumber(),
  widthCm: optNonNegNumber(),
  heightCm: optNonNegNumber(),
});

const colorSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  imageUrl: optionalStoredPublicMediaUrlSchema,
});

const imageSchema = z.object({
  id: z.string().optional(),
  url: storedPublicMediaUrlSchema,
  alt: z.string().optional(),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const productAdminSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .max(200)
    .regex(/^[a-z0-9-]*$/)
    .optional()
    .default(""),
  description: z.string().optional(),
  details: z.string().optional(),
  category: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Z0-9_]+$/, "Pick or add a category."),
  type: z.nativeEnum(ProductType),
  tags: z.array(z.string()).default([]),
  basePriceNGN: z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  }, z.number().min(0)),
  basePriceUSD: optNonNegNumber(),
  basePriceGBP: optNonNegNumber(),
  isOnSale: z.boolean().default(false),
  saleEndsAt: z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const d = v instanceof Date ? v : new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d;
  }, z.date().nullable().optional()),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isBespokeAvail: z.boolean().default(false),
  customOffered: z.boolean().optional(),
  customSurchargeKind: z.enum(["NONE", "PERCENT", "FLAT"]).optional().nullable(),
  customSurchargeValue: optNonNegNumber(),
  customLeadTimeDays: z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return undefined;
    return n;
  }, z.number().int().min(1).max(180).optional()),
  customReturnable: z.boolean().optional().nullable(),
  measurementFieldIds: z
    .array(
      z.object({
        fieldId: z.string().min(1),
        required: z.boolean().default(true),
        sortOrder: z.number().int().default(0),
      }),
    )
    .optional()
    .default([]),
  optionGroup: z
    .object({
      id: z.string().optional(),
      label: z.string().trim().min(1).max(80),
      isRequired: z.boolean().default(true),
      includeInSku: z.boolean().default(true),
      sortOrder: z.coerce.number().int().default(0),
      options: z
        .array(
          z.object({
            id: z.string().optional(),
            label: z.string().trim().min(1).max(80),
            priceAdjustmentNGN: z.coerce.number(),
            isDefault: z.boolean().default(false),
            sortOrder: z.coerce.number().int().default(0),
            skuPart: z.string().max(8).optional().nullable(),
            measurementFieldIds: z
              .array(
                z.object({
                  fieldId: z.string().min(1),
                  required: z.boolean().default(true),
                  sortOrder: z.number().int().default(0),
                }),
              )
              .optional()
              .default([]),
          }),
        )
        .min(2, "Add at least two choices"),
    })
    .nullable()
    .optional(),
  defaultWeightKg: optNonNegNumber(),
  defaultLengthCm: optNonNegNumber(),
  defaultWidthCm: optNonNegNumber(),
  defaultHeightCm: optNonNegNumber(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  variants: z.array(variantSchema).default([]),
  colors: z.array(colorSchema).default([]),
  images: z.array(imageSchema).default([]),
  bundleProductIds: z.array(z.string()).max(4).default([]),
  regenerateSkus: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (!data.name.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["name"],
      message: "Give this piece a name to save a draft.",
    });
  }
  if (data.optionGroup && data.optionGroup.options.length > 0) {
    const defaults = data.optionGroup.options.filter((o) => o.isDefault);
    if (defaults.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["optionGroup", "options"],
        message: "Mark exactly one choice as the default.",
      });
    }
  }
  if (!data.isPublished) return;
  for (const need of missingPublishNeeds(data)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [need.path],
      message: `To publish this piece it still needs ${need.label}.`,
    });
  }
});

export const productToggleSchema = z.object({
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
});

export type ProductAdminInput = z.infer<typeof productAdminSchema>;
