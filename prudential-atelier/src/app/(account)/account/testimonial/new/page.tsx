import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canSubmitTestimonial } from "@/lib/testimonial-eligibility";
import { TestimonialSubmitClient } from "@/components/account/TestimonialSubmitClient";

export default async function NewTestimonialPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const eligibility = await canSubmitTestimonial(session.user.id);
  if (!eligibility.eligible) redirect("/account");
  if (eligibility.hasExistingTestimonial) redirect("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });
  const firstName = (user?.name ?? "there").split(/\s+/)[0] ?? "there";

  return (
    <div className="px-4 py-8 md:px-8">
      <TestimonialSubmitClient firstName={firstName} />
    </div>
  );
}
