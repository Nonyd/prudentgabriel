import { z } from "zod";

export const couponValidateSchema = z.object({
  code: z.string().min(1).max(50),
  subtotalNGN: z.number().positive(),
  email: z.string().email(),
  cartLines: z.array(
    z.object({
      priceNGN: z.number(),
      quantity: z.number().int().positive(),
      category: z.string().optional(),
    }),
  ),
});

export const couponAdminSchema = z.object({
  code: z.string().min(3).max(30).transform((s) => s.toUpperCase()),
  description: z.string().optional(),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
  value: z.number().min(0),
  minOrderNGN: z.number().optional(),
  maxUsesTotal: z.number().int().optional(),
  maxUsesPerUser: z.number().int().min(1).default(1),
  appliesToAll: z.boolean().default(true),
  categoryScope: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
});
