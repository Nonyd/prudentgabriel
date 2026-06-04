"use client";

import { AppearanceSettingsCard } from "@/components/admin/settings/AppearanceSettingsCard";
import { LogoSettingsCard } from "@/components/admin/settings/LogoSettingsCard";
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
  const logoDark = rows.find((r) => r.key === "logo_dark");
  const logoWhite = rows.find((r) => r.key === "logo_white");
  const siteImageRows = rows.filter((r) => r.key !== "logo_dark" && r.key !== "logo_white");

  return (
    <div className="space-y-10">
      {logoDark && logoWhite ? (
        <div>
          <h2 className="font-body text-xs font-medium uppercase tracking-[0.14em] text-[#6B6B68]">
            Appearance
          </h2>
          <p className="mt-2 max-w-xl font-body text-[13px] leading-relaxed text-[#6B6B68]">
            Brand logos used across the storefront, account area, admin, and email templates.
          </p>
          <div className="mt-6">
            <LogoSettingsCard logoDark={logoDark} logoWhite={logoWhite} onSaved={onSaved} />
          </div>
        </div>
      ) : null}

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
