import { EmailOutboxClient } from "@/components/admin/EmailOutboxClient";

export default function AdminSystemEmailsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Email outbox</h1>
      <p className="mt-1 max-w-2xl font-body text-[13px] text-[#6B6B68]">
        Every outbound message is recorded here. Failed sends retry automatically;
        DEAD means a human needs to look. ADMIN / SUPER_ADMIN only.
      </p>
      <EmailOutboxClient />
    </div>
  );
}
