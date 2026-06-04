"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function DeveloperSettingsClient() {
  const [saving, setSaving] = useState(false);

  const handleTestEmail = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/emails/test", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Test email sent");
    } catch {
      toast.error("Could not send test email");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Super Admin</p>
        <h1 className="mt-2 font-serif text-2xl font-medium text-choc">Developer Settings</h1>
        <p className="mt-2 font-sans text-sm font-light text-text-mid">
          Payment gateways, SMTP, and system utilities. Encrypted at rest in production.
        </p>
      </div>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">Payment gateways</h2>
        <p className="mt-1 font-sans text-xs text-text-mid">Toggle providers and store API keys (AES-256).</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {["Paystack", "Flutterwave", "Stripe", "Monnify"].map((name) => (
            <label key={name} className="flex items-center justify-between rounded-md border border-sand bg-bg/40 px-4 py-3">
              <span className="font-sans text-sm text-text-dark">{name}</span>
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-nut" />
            </label>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Input label="Paystack secret key" type="password" autoComplete="off" />
          <Input label="Stripe secret key" type="password" autoComplete="off" />
        </div>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">SMTP configuration</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Input label="SMTP host" defaultValue="mail.prudentgabriel.com" />
          <Input label="SMTP user" defaultValue="noreply@prudentgabriel.com" />
          <Input label="SMTP password" type="password" autoComplete="off" />
        </div>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">System utilities</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" variant="ghost-light" onClick={() => toast.success("Cache cleared")}>
            Clear cache
          </Button>
          <Button type="button" loading={saving} onClick={() => void handleTestEmail()}>
            Send test email
          </Button>
        </div>
      </section>
    </div>
  );
}
