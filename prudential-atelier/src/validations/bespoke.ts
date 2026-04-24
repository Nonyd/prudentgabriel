import { z } from "zod";

export const bespokeRequestSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  country: z.string().min(2),
  source: z.string().optional(),
  occasion: z.string().min(1),
  description: z.string().min(20),
  budgetRange: z.string().min(1),
  timeline: z.string().min(1),
  referenceImages: z.array(z.string().url()).max(5).optional().default([]),
  measurements: z
    .object({
      bust: z.string().optional(),
      waist: z.string().optional(),
      hips: z.string().optional(),
      height: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  preferredDate: z.coerce.date().optional(),
  consultationFeeAccepted: z.boolean().optional(),
});
