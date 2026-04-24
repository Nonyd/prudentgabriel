import { AdminSettingsClient } from "@/components/admin/AdminSettingsClient";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-black">Settings</h1>
      <AdminSettingsClient />
    </div>
  );
}
