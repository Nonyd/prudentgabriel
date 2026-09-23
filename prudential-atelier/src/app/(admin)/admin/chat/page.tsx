import { AdminChatClient } from "@/components/admin/AdminChatClient";

export const dynamic = "force-dynamic";

/** BA5: live chat inbox and its settings. */
export default async function AdminChatPage({ searchParams }: { searchParams?: Promise<{ open?: string }> }) {
  const sp = (await searchParams) ?? {};
  return (
    <div>
      <h1 className="admin-heading-pill glass-1 glass-pill font-display text-2xl text-ink">Chat</h1>
      <p className="mt-1 font-body text-[13px] text-[#6B6B68]">
        General support: the shop, orders, sizing, delivery. Commissions go through the enquiry form — never quote a gown
        here.
      </p>
      <AdminChatClient openId={sp.open ?? null} />
    </div>
  );
}
