import { z } from "zod";
import {
  ConsultationSessionType,
  ConsultationDeliveryMode,
  Currency,
} from "@prisma/client";
import { storedPrivateMediaUrlSchema, optionalStoredPublicMediaUrlSchema } from "@/lib/media/stored-url";
import {
  ENQUIRY_EVENT_TYPES,
  ENQUIRY_OUTFIT_TYPES,
  ENQUIRY_WEARERS,
} from "@/lib/consultation-enquiry-shared";

export const OFFERING_TYPE_VALUES = [
  "PHYSICAL_PRUDENT_TEAM",
  "PHYSICAL_TEAM_ONLY",
  "VIRTUAL_PRUDENT_TEAM",
  "VIRTUAL_TEAM_ONLY",
] as const;

/** BA2: the atelier application. Name, email and phone, the event, and the screening questions. */
export const consultationEnquirySchema = z.object({
  clientName: z.string().trim().min(2).max(100),
  clientEmail: z.string().trim().email().max(200),
  clientPhone: z.string().trim().min(7).max(20),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventType: z.enum(ENQUIRY_EVENT_TYPES),
  wearer: z.enum(ENQUIRY_WEARERS.map((w) => w.id) as [string, ...string[]]),
  outfitType: z.enum(ENQUIRY_OUTFIT_TYPES),
  notes: z.string().trim().max(2000).optional(),
  moodboardImages: z.array(storedPrivateMediaUrlSchema).max(5).default([]),
});

export type ConsultationEnquiryInput = z.infer<typeof consultationEnquirySchema>;

/**
 * BA2: a booking is made only through an approved enquiry's link. Name, email,
 * occasion and moodboard come from the enquiry; the client chooses the type,
 * proposes three dates and acknowledges the non-refundable terms.
 */
export const consultationBookingSchema = z.object({
  enquiryToken: z.string().min(32).max(200),
  termsAccepted: z.literal(true),
  /** The wording she saw; must match what the server shows for this fee. */
  termsText: z.string().min(20).max(1000),
  /** BA3: the fee she was shown in her currency; must equal what the booking locks. */
  quotedAmount: z.number().positive(),
  offeringId: z.string().min(1),
  consultantId: z.string().min(1),
  offeringType: z.enum(OFFERING_TYPE_VALUES),
  virtualPlatform: z.enum(["zoom", "google_meet", "whatsapp_video"]).optional(),
  /** Consultations are priced in NGN, USD or GBP only (BA3 locks USD/GBP). */
  currency: z.enum([Currency.NGN, Currency.USD, Currency.GBP]).default(Currency.NGN),
  gateway: z.enum(["PAYSTACK", "FLUTTERWAVE", "STRIPE", "MONNIFY", "BANK_TRANSFER"]),
  paymentRef: z.string().regex(/^PA-CONSULT-/i).optional(),

  clientPhone: z.string().min(7).max(20).optional(),
  clientCountry: z.string().min(2).default("NG"),
  clientInstagram: z.string().optional(),

  description: z.string().max(2000).optional(),
  referenceImages: z.array(storedPrivateMediaUrlSchema).max(5).default([]),

  preferredDate1: z.coerce.date(),
  preferredDate2: z.coerce.date(),
  preferredDate3: z.coerce.date(),
  attribution: z
    .object({
      source: z.string().max(80).optional(),
      medium: z.string().max(80).optional(),
      campaign: z.string().max(120).optional(),
      content: z.string().max(120).optional(),
      referrer: z.string().max(120).optional(),
      landingPath: z.string().max(200).optional(),
    })
    .optional(),
});

export type ConsultationBookingInput = z.infer<typeof consultationBookingSchema>;

export const consultantAdminSchema = z.object({
  name: z.string().min(2),
  title: z.string().min(2),
  bio: z.string().min(10),
  image: optionalStoredPublicMediaUrlSchema,
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
