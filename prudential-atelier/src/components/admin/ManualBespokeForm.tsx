"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import type { BespokeStatus } from "@prisma/client";

type UploadItem = { url: string; name: string; isPdf: boolean };

export function ManualBespokeForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sketches, setSketches] = useState<UploadItem[]>([]);
  const [refs, setRefs] = useState<UploadItem[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [heardFrom, setHeardFrom] = useState("Walk-in");
  const [occasion, setOccasion] = useState("White Wedding");
  const [description, setDescription] = useState("");
  const [budgetRange, setBudgetRange] = useState("₦200k–₦500k");
  const [timeline, setTimeline] = useState("2–4 weeks");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [depositPaid, setDepositPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [adminNotes, setAdminNotes] = useState("");
  const [status, setStatus] = useState<BespokeStatus>("CONFIRMED");

  async function uploadFile(file: File, folder: string): Promise<UploadItem> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    if (file.type === "application/pdf") fd.append("allowPdf", "true");
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const j = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !j.url) throw new Error(j.error ?? "Upload failed");
    return { url: j.url, name: file.name, isPdf: file.type === "application/pdf" };
  }

  const onSketches = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files).slice(0, 10)) {
      try {
        const u = await uploadFile(f, "prudent-gabriel/bespoke-sketches");
        setSketches((s) => [...s, u]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    }
  };

  const onRefs = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files).slice(0, 5)) {
      try {
        const u = await uploadFile(f, "prudent-gabriel/bespoke-refs");
        setRefs((s) => [...s, u]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    }
  };

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
    setDescription("");
    setAgreedPrice("");
    setDepositPaid("");
    setAdminNotes("");
    setSketches([]);
    setRefs([]);
  };

  const submit = async () => {
    const price = parseFloat(agreedPrice);
    if (!name.trim() || !phone.trim() || description.trim().length < 10 || !Number.isFinite(price) || price <= 0) {
      toast.error("Please complete required fields");
      return;
    }
    const dep = parseFloat(depositPaid) || 0;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/bespoke/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          country,
          heardFrom,
          occasion,
          description: description.trim(),
          budgetRange,
          timeline,
          agreedPrice: price,
          depositPaid: dep,
          paymentMethod,
          referenceImageUrls: refs.map((r) => r.url),
          sketchUrls: sketches.map((s) => s.url),
          adminNotes: adminNotes.trim(),
          status,
        }),
      });
      const j = (await res.json()) as { success?: boolean; requestNumber?: string; error?: unknown };
      if (!res.ok) {
        toast.error("Could not save");
        return;
      }
      toast.success(`Bespoke request #${j.requestNumber ?? ""} created ✓`);
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 border border-[#37392d] bg-[#37392d] px-4 py-2 font-body text-[11px] font-medium uppercase tracking-wide text-white"
      >
        + Add manual request
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[121] max-h-[92vh] w-[min(96vw,640px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-[#EBEBEA] bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-display text-[22px] text-black">Add manual bespoke request</Dialog.Title>
                <p className="mt-1 font-body text-xs text-[#6B6B68]">For clients who placed orders offline or by phone.</p>
              </div>
              <Dialog.Close className="text-charcoal" aria-label="Close">
                <X size={20} />
              </Dialog.Close>
            </div>

            <div className="mt-6 space-y-4 font-body text-sm">
              <p className="text-[11px] font-medium uppercase text-[#6B6B68]">Client</p>
              <input className="w-full border border-[#EBEBEA] px-3 py-2" placeholder="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="w-full border border-[#EBEBEA] px-3 py-2" placeholder="Phone *" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className="w-full border border-[#EBEBEA] px-3 py-2" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
              <select className="w-full border border-[#EBEBEA] px-3 py-2" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option>Nigeria</option>
                <option>Other</option>
              </select>
              <select className="w-full border border-[#EBEBEA] px-3 py-2" value={heardFrom} onChange={(e) => setHeardFrom(e.target.value)}>
                {["Walk-in", "Phone call", "WhatsApp", "Referral", "Other"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>

              <p className="pt-2 text-[11px] font-medium uppercase text-[#6B6B68]">Order</p>
              <select className="w-full border border-[#EBEBEA] px-3 py-2" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
                {["White Wedding", "Traditional Wedding", "Corporate Event", "Birthday", "Other"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <textarea
                className="min-h-[100px] w-full resize-y border border-[#EBEBEA] px-3 py-2"
                placeholder="Description (min 10 chars) *"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <select className="w-full border border-[#EBEBEA] px-3 py-2" value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)}>
                <option>Under ₦200k</option>
                <option>₦200k–₦500k</option>
                <option>₦500k–₦1M</option>
                <option>Above ₦1M</option>
              </select>
              <select className="w-full border border-[#EBEBEA] px-3 py-2" value={timeline} onChange={(e) => setTimeline(e.target.value)}>
                <option>Under 2 weeks</option>
                <option>2–4 weeks</option>
                <option>1–2 months</option>
                <option>3+ months</option>
              </select>

              <p className="pt-2 text-[11px] font-medium uppercase text-[#6B6B68]">Pricing</p>
              <input className="w-full border border-[#EBEBEA] px-3 py-2" placeholder="Agreed price (₦) *" value={agreedPrice} onChange={(e) => setAgreedPrice(e.target.value)} />
              <select className="w-full border border-[#EBEBEA] px-3 py-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {["Cash", "Bank Transfer", "POS", "Paid Online", "Pending"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <input className="w-full border border-[#EBEBEA] px-3 py-2" placeholder="Deposit paid (₦)" value={depositPaid} onChange={(e) => setDepositPaid(e.target.value)} />
              <p className="text-xs text-[#37392d]">
                Balance: ₦
                {Math.max(0, (parseFloat(agreedPrice) || 0) - (parseFloat(depositPaid) || 0)).toLocaleString("en-NG")}
              </p>

              <p className="pt-2 text-[11px] font-medium uppercase text-[#6B6B68]">Sketches / refs</p>
              <input type="file" multiple accept="image/*,application/pdf" className="text-xs" onChange={(e) => void onSketches(e.target.files)} />
              <input type="file" multiple accept="image/*" className="text-xs" onChange={(e) => void onRefs(e.target.files)} />
              <p className="text-[11px] text-[#6B6B68]">{sketches.length} sketch files · {refs.length} reference images</p>

              <textarea className="min-h-[72px] w-full border border-[#EBEBEA] px-3 py-2" placeholder="Internal admin notes" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />

              <select className="w-full border border-[#EBEBEA] px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as BespokeStatus)}>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="IN_PROGRESS">In progress</option>
              </select>
            </div>

            <div className="mt-8 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="border border-[#EBEBEA] px-6 py-2 text-xs uppercase">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submit()}
                className="bg-[#37392d] px-6 py-2 text-xs uppercase text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save manual request"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
