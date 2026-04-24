import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.enum(["General", "Order Enquiry", "Press", "Bespoke", "Other"]),
  message: z.string().min(10),
});
