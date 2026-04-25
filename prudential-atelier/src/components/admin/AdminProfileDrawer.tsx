"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Lock, X } from "lucide-react";
import { DarkModeToggle } from "@/components/common/DarkModeToggle";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0] || "AD").slice(0, 2).toUpperCase();
}

export function AdminProfileDrawer({
  isOpen,
  onClose,
  initialName,
  initialEmail,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  initialEmail: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [firstName, setFirstName] = useState(initialName.split(" ")[0] || "");
  const [lastName, setLastName] = useState(initialName.split(" ").slice(1).join(" "));
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function saveProfile() {
    await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone, image }),
    });
  }

  async function updatePassword() {
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) return;
    await fetch("/api/account/profile/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function uploadAvatar(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "prudential-atelier/avatars/admin");
    const response = await fetch("/api/admin/upload", { method: "POST", body: form });
    if (!response.ok) return;
    const json = (await response.json()) as { url?: string };
    if (json.url) setImage(json.url);
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-40 bg-black/20"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[360px] flex-col border-l border-[#EBEBEA] bg-white"
            initial={{ x: 360 }}
            animate={{ x: 0 }}
            exit={{ x: 360 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-[#EBEBEA] px-6 py-4">
              <h3 className="font-display text-[20px] text-ink">My Profile</h3>
              <button type="button" onClick={onClose} className="text-[#6B6B68] hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6" data-lenis-prevent>
              <div className="mb-6 flex flex-col items-center">
                {image ? (
                  <img src={image} alt="Admin avatar" className="h-[72px] w-[72px] rounded-full object-cover" />
                ) : (
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#37392d] font-body text-xl text-white">
                    {getInitials(`${firstName} ${lastName}`.trim() || initialName)}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadAvatar(file);
                  }}
                />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 font-body text-[11px] text-[#6B6B68] hover:text-ink">
                  Change Photo
                </button>
                <p className="mt-3 text-center font-display text-[20px] text-ink">{`${firstName} ${lastName}`.trim() || initialName}</p>
                <span className="mt-1 border border-[#37392d] px-2 py-0.5 font-body text-[10px] uppercase tracking-[0.08em] text-[#37392d]">SUPER ADMIN</span>
              </div>

              <div className="space-y-3">
                <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First Name" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
                <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last Name" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
                <div className="relative">
                  <input value={initialEmail} disabled className="w-full border border-[#EBEBEA] bg-[#FAFAFA] px-3 py-2 pr-8 font-body text-sm text-[#6B6B68]" />
                  <Lock size={14} className="absolute right-3 top-3 text-[#A8A8A4]" />
                </div>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
                <button type="button" onClick={() => void saveProfile()} className="w-full bg-[#37392d] px-3 py-2 font-body text-[12px] uppercase tracking-[0.08em] text-white">
                  Save Profile
                </button>
              </div>

              <div className="my-6 border-t border-[#EBEBEA]" />

              <p className="mb-3 font-body text-[11px] uppercase tracking-[0.08em] text-[#6B6B68]">Change Password</p>
              <div className="space-y-3">
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current Password" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New Password" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm Password" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
                <button type="button" onClick={() => void updatePassword()} className="w-full border border-[#37392d] px-3 py-2 font-body text-[12px] uppercase tracking-[0.08em] text-[#37392d]">
                  Update Password
                </button>
              </div>

              <div className="my-6 border-t border-[#EBEBEA]" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-body text-[11px] uppercase tracking-[0.08em] text-[#6B6B68]">Display</p>
                  <p className="font-body text-[11px] text-[#6B6B68]">Affects storefront preview only</p>
                </div>
                <DarkModeToggle />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#EBEBEA] px-6 py-4">
              <Link href="/" className="font-body text-xs text-[#6B6B68] hover:text-ink">
                ← Back to Store
              </Link>
              <button type="button" onClick={() => void signOut({ callbackUrl: "/admin-login" })} className="font-body text-xs text-red-500 hover:text-red-600">
                Logout
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
