import { z } from "zod";

export const CONTACT_SUBJECTS = [
  "General Enquiry",
  "Book a Consultation",
  "Ready-to-Wear Order",
  "Atelier Commission",
  "Bridal Enquiry",
  "Press & Media",
  "Collaboration",
] as const;

export const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional(),
  subject: z.enum(CONTACT_SUBJECTS, { message: "Select a subject" }),
  message: z.string().min(20, "Message must be at least 20 characters"),
});
