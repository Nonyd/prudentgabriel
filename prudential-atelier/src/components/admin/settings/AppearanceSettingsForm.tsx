"use client";

import { AppearanceSettingsCard } from "@/components/admin/settings/AppearanceSettingsCard";
import type { SettingType } from "@prisma/client";

type Row = {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
};

export function AppearanceSettingsForm({
  rows,
  onSaved,
}: {
  rows: Row[];
  onSaved: () => void;
}) {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-body text-xs font-medium uppercase tracking-[0.14em] text-[#6B6B68]">Site images</h2>
        <p className="mt-2 max-w-xl font-body text-[13px] leading-relaxed text-[#6B6B68]">
          These images appear throughout the website. Click Upload to replace any image, or paste a CDN URL.
        </p>
      </div>
      <AppearanceSettingsCard rows={rows} onSaved={onSaved} />
    </div>
  );
}
