export default function AdminSettingsPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-2xl text-charcoal">Settings</h1>
      <div className="rounded-sm border border-[#EBEBEA] bg-white p-6 text-sm text-[#6B6B68]">
        <p className="font-display text-lg text-gold">Store</p>
        <p className="mt-2">Store name: Prudential Atelier</p>
        <p>Admin email: {process.env.ADMIN_EMAIL ?? "admin@prudentgabriel.com"}</p>
        <p className="mt-6 text-xs text-[#A8A8A4]">
          Full configurable settings (points rates, shipping thresholds) can be wired to the database in a future
          iteration. Environment variables remain the source of truth for payments and email.
        </p>
      </div>
    </div>
  );
}
