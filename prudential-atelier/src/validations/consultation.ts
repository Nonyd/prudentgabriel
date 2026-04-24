import { z } from "zod";
import {
  ConsultationSessionType,
  ConsultationDeliveryMode,
  Currency,
} from "@prisma/client";

export const consultationBookingSchema = z.object({
  offeringId: z.string().min(1),
  consultantId: z.string().min(1),
  currency: z.nativeEnum(Currency).default(Currency.NGN),
  gateway: z.enum(["PAYSTACK", "FLUTTERWAVE", "STRIPE", "MONNIFY"]),

  clientName: z.string().min(2).max(100),
  clientEmail: z.string().email(),
  clientPhone: z.string().min(7).max(20),
  clientCountry: z.string().min(2),
  clientInstagram: z.string().optional(),

  occasion: z.string().min(1),
  description: z.string().min(20).max(2000),
  referenceImages: z.array(z.string().url()).max(5).default([]),

  confirmedDate: z.coerce.date().optional(),
  confirmedTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),

  preferredDate1: z.coerce.date().optional(),
  preferredDate2: z.coerce.date().optional(),
  preferredDate3: z.coerce.date().optional(),
});

export type ConsultationBookingInput = z.infer<typeof consultationBookingSchema>;

export const consultantAdminSchema = z.object({
  name: z.string().min(2),
  title: z.string().min(2),
  bio: z.string().min(10),
  image: z.string().url().optional(),
  isActive: z.boolean().default(true),
  isFlagship: z.boolean().default(false),
  displayOrder: z.number().int().min(0).default(0),
  offerings: z.array(
    z.object({
      id: z.string().optional(),
      sessionType: z.nativeEnum(ConsultationSessionType),
      deliveryMode: z.nativeEnum(ConsultationDeliveryMode),
      durationMinutes: z.number().int().min(15).max(240),
      feeNGN: z.number().min(0),
      feeUSD: z.number().min(0).optional(),
      feeGBP: z.number().min(0).optional(),
      isActive: z.boolean().default(true),
      description: z.string().optional(),
    }),
  ),
  availability: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      isActive: z.boolean().default(true),
    }),
  ),
});

export type ConsultantAdminInput = z.infer<typeof consultantAdminSchema>;
