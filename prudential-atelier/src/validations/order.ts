import { z } from "zod";

export const addressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(7),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().optional(),
  country: z.string().length(2).default("NG"),
  saveAddress: z.boolean().optional().default(false),
});

export const checkoutSchema = z.object({
  addressId: z.string().optional(),
  address: addressSchema.optional(),
  shippingZoneId: z.string().min(1),
  notes: z.string().max(500).optional(),
  isGift: z.boolean().optional().default(false),
  giftMessage: z.string().max(200).optional(),
  currency: z.enum(["NGN", "USD", "GBP"]),
  gateway: z.enum(["PAYSTACK", "FLUTTERWAVE", "STRIPE", "MONNIFY"]),
  couponCode: z.string().optional(),
  pointsToRedeem: z.number().int().min(0).optional().default(0),
  guestEmail: z.string().email().optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
});

export const guestCartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.number().int().positive(),
  size: z.string().min(1),
  color: z.string().optional(),
  colorHex: z.string().optional(),
  colorId: z.string().optional(),
});

export const orderCreateBodySchema = checkoutSchema.extend({
  cartLines: z.array(guestCartLineSchema).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type OrderCreateBody = z.infer<typeof orderCreateBodySchema>;
