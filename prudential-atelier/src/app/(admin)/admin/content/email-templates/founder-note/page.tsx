import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FounderNoteEditor } from "@/components/admin/content/FounderNoteEditor";

export default async function FounderNotePage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/admin/content/email-templates");

  return (
    <div>
      <Link href="/admin/content/email-templates" className="font-body text-xs text-text-mid underline">
        ← Email templates
      </Link>
      <h1 className="admin-heading-pill glass-1 glass-pill mt-3 font-display text-2xl text-ink">Founder&apos;s note</h1>
      <p className="mt-1 max-w-2xl font-body text-sm text-text-mid">
        A personal letter from Mrs Prudent Gabriel-Okopi, emailed ten minutes after a client&apos;s account is created:
        when she signs up, when her first order, consultation or commission creates one, or when she first signs in
        with Google. Only you can change the words.
      </p>
      <FounderNoteEditor />
    </div>
  );
}
