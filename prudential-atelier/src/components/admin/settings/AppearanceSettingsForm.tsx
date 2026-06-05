"use client";

import { AppearanceSettingsCard } from "@/components/admin/settings/AppearanceSettingsCard";
import { SubBrandLogosSettingsCard } from "@/components/admin/settings/SubBrandLogosSettingsCard";
import type { SettingType } from "@prisma/client";

type Row = {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
};

const LOGO_KEYS = new Set([
  "logo_dark",
  "logo_white",
  "logo_atelier_dark",
  "logo_atelier_white",
  "logo_bridal_dark",
  "logo_bridal_white",
  "logo_kids_dark",
  "logo_kids_white",
  "img_logo_atelier",
  "img_logo_bridal",
  "img_logo_kids",
]);

export function AppearanceSettingsForm({
  rows,
  onSaved,
}: {
  rows: Row[];
  onSaved: () => void;
}) {
  const logoRows = rows.filter((r) => LOGO_KEYS.has(r.key));
  const siteImageRows = rows.filter((r) => !LOGO_KEYS.has(r.key));

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-body text-xs font-medium uppercase tracking-[0.14em] text-[#6B6B68]">
          Brand logos
        </h2>
        <p className="mt-2 max-w-xl font-body text-[13px] leading-relaxed text-[#6B6B68]">
          Upload logos for the main brand and each sub-brand. Dark logo appears on light backgrounds;
          white logo on dark backgrounds.
        </p>
        <div className="mt-6">
          <SubBrandLogosSettingsCard rows={logoRows} onSaved={onSaved} />
        </div>
      </div>

      <div>
        <h2 className="font-body text-xs font-medium uppercase tracking-[0.14em] text-[#6B6B68]">
          Site images
        </h2>
        <p className="mt-2 max-w-xl font-body text-[13px] leading-relaxed text-[#6B6B68]">
          These images appear throughout the website. Click Upload to replace any image, or paste a CDN URL.
        </p>
      </div>
      <AppearanceSettingsCard rows={siteImageRows} onSaved={onSaved} />
    </div>
  );
}
