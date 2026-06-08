import type { ConsultantOffering } from "@prisma/client";
import { ConsultationDeliveryMode as DeliveryMode } from "@prisma/client";
import type { ConsultantWithOfferings } from "@/lib/consultation";
import { cmsGet } from "@/lib/cms-helpers";

export const OFFERING_TYPES = [
  "PHYSICAL_PRUDENT_TEAM",
  "PHYSICAL_TEAM_ONLY",
  "VIRTUAL_PRUDENT_TEAM",
  "VIRTUAL_TEAM_ONLY",
] as const;

export type OfferingTypeKey = (typeof OFFERING_TYPES)[number];

export const VIRTUAL_PLATFORMS = [
  { id: "zoom", label: "Zoom" },
  { id: "google_meet", label: "Google Meet" },
  { id: "whatsapp_video", label: "WhatsApp Video Call" },
] as const;

export type VirtualPlatformId = (typeof VIRTUAL_PLATFORMS)[number]["id"];

const CMS_PREFIX: Record<OfferingTypeKey, string> = {
  PHYSICAL_PRUDENT_TEAM: "consultation_type_physical_prudent",
  PHYSICAL_TEAM_ONLY: "consultation_type_physical_team",
  VIRTUAL_PRUDENT_TEAM: "consultation_type_virtual_prudent",
  VIRTUAL_TEAM_ONLY: "consultation_type_virtual_team",
};

const LEGACY_CMS_PREFIX: Partial<Record<OfferingTypeKey, string>> = {
  PHYSICAL_PRUDENT_TEAM: "consultation_type1",
  PHYSICAL_TEAM_ONLY: "consultation_type2",
  VIRTUAL_TEAM_ONLY: "consultation_type3",
};

const DEFAULT_UI: Record<
  OfferingTypeKey,
  {
    formatLabel: string;
    title: string;
    description: string;
    features: string[];
    defaultPriceNgn: number;
    defaultPriceUsd: number;
    defaultPriceGbp: number;
    defaultDuration: string;
    isVirtual: boolean;
    includesPrudent: boolean;
  }
> = {
  PHYSICAL_PRUDENT_TEAM: {
    formatLabel: "PHYSICAL",
    title: "Mrs. Prudent Gabriel-Okopi & The Creative Team",
    description: "A private session led by Mrs. Prudent herself.",
    features: ["Led by Mrs. Prudent", "Full creative team", "Premium fabric access", "Up to 90 minutes"],
    defaultPriceNgn: 150000,
    defaultPriceUsd: 120,
    defaultPriceGbp: 95,
    defaultDuration: "Up to 90 minutes",
    isVirtual: false,
    includesPrudent: true,
  },
  PHYSICAL_TEAM_ONLY: {
    formatLabel: "PHYSICAL",
    title: "The Creative Team",
    description: "Work with our senior designers in our Lagos atelier.",
    features: ["Senior design team", "In-atelier fabric viewing", "Up to 60 minutes"],
    defaultPriceNgn: 75000,
    defaultPriceUsd: 60,
    defaultPriceGbp: 48,
    defaultDuration: "Up to 60 minutes",
    isVirtual: false,
    includesPrudent: false,
  },
  VIRTUAL_PRUDENT_TEAM: {
    formatLabel: "VIRTUAL",
    title: "Mrs. Prudent Gabriel-Okopi & The Creative Team",
    description: "Meet virtually with Mrs. Prudent from anywhere.",
    features: ["Led by Mrs. Prudent", "Full creative team", "Screen-shared lookbook", "Up to 60 minutes"],
    defaultPriceNgn: 60000,
    defaultPriceUsd: 48,
    defaultPriceGbp: 38,
    defaultDuration: "Up to 60 minutes",
    isVirtual: true,
    includesPrudent: true,
  },
  VIRTUAL_TEAM_ONLY: {
    formatLabel: "VIRTUAL",
    title: "The Creative Team",
    description: "Connect with our designers from anywhere.",
    features: ["Senior design team", "Screen-shared lookbook", "Up to 45 minutes"],
    defaultPriceNgn: 40000,
    defaultPriceUsd: 32,
    defaultPriceGbp: 26,
    defaultDuration: "Up to 45 minutes",
    isVirtual: true,
    includesPrudent: false,
  },
};

function cmsVal(cms: Record<string, string>, prefix: string, key: string, fallback: string): string {
  const primary = cmsGet(cms, `${prefix}_${key}`, "");
  if (primary) return primary;
  return fallback;
}

export function getOfferingTypeConfig(key: OfferingTypeKey, cms: Record<string, string> = {}) {
  const base = DEFAULT_UI[key];
  const prefix = CMS_PREFIX[key];
  const legacy = LEGACY_CMS_PREFIX[key];

  const read = (field: string, fallback: string) => {
    const v = cmsVal(cms, prefix, field, "");
    if (v) return v;
    if (legacy) return cmsVal(cms, legacy, field, fallback);
    return fallback;
  };

  const enabledRaw = read("enabled", "true");
  const features = [
    read("feature_1", base.features[0] ?? ""),
    read("feature_2", base.features[1] ?? ""),
    read("feature_3", base.features[2] ?? ""),
  ].filter(Boolean);

  return {
    key,
    formatLabel: read("badge", base.formatLabel) || base.formatLabel,
    title: read("title", base.title),
    description: read("description", base.description),
    features: features.length ? features : base.features,
    duration: read("duration", base.defaultDuration),
    priceNgn: Number(read("price_ngn", String(base.defaultPriceNgn))) || base.defaultPriceNgn,
    priceUsd: Number(read("price_usd", String(base.defaultPriceUsd))) || base.defaultPriceUsd,
    priceGbp: Number(read("price_gbp", String(base.defaultPriceGbp))) || base.defaultPriceGbp,
    enabled: enabledRaw !== "false",
    isVirtual: base.isVirtual,
    includesPrudent: base.includesPrudent,
    location: base.isVirtual ? null : "Lagos Atelier",
  };
}

export function isOfferingTypeVirtual(key: OfferingTypeKey): boolean {
  return DEFAULT_UI[key].isVirtual;
}

export function isOfferingTypeManual(key: OfferingTypeKey): boolean {
  return DEFAULT_UI[key].includesPrudent;
}

export function offeringTypeMatches(
  key: OfferingTypeKey,
  consultant: ConsultantWithOfferings,
  offering: ConsultantOffering,
): boolean {
  switch (key) {
    case "PHYSICAL_PRUDENT_TEAM":
      return (
        consultant.isFlagship &&
        (offering.deliveryMode === DeliveryMode.INPERSON_ATELIER_PRUDENT ||
          offering.deliveryMode === DeliveryMode.INPERSON_HOME_PRUDENT)
      );
    case "PHYSICAL_TEAM_ONLY":
      return (
        !consultant.isFlagship &&
        (offering.deliveryMode === DeliveryMode.INPERSON_ATELIER ||
          offering.deliveryMode === DeliveryMode.INPERSON_HOME_TEAM)
      );
    case "VIRTUAL_PRUDENT_TEAM":
      return offering.deliveryMode === DeliveryMode.VIRTUAL_WITH_PRUDENT;
    case "VIRTUAL_TEAM_ONLY":
      return (
        !consultant.isFlagship &&
        (offering.deliveryMode === DeliveryMode.VIRTUAL_STANDARD ||
          offering.deliveryMode === DeliveryMode.VIRTUAL_WITH_TEAM ||
          offering.deliveryMode === DeliveryMode.PHONE_CALL)
      );
    default:
      return false;
  }
}

export function resolveOfferingType(
  consultants: ConsultantWithOfferings[],
  key: OfferingTypeKey,
): { consultant: ConsultantWithOfferings; offering: ConsultantOffering } | null {
  for (const c of consultants) {
    const offering = c.offerings.find((o) => o.isActive && offeringTypeMatches(key, c, o));
    if (offering) return { consultant: c, offering };
  }

  if (key === "PHYSICAL_PRUDENT_TEAM") {
    const c = consultants.find((x) => x.isFlagship && x.offerings[0]);
    if (c) return { consultant: c, offering: c.offerings[0] };
  }
  if (key === "PHYSICAL_TEAM_ONLY" || key === "VIRTUAL_TEAM_ONLY") {
    const c = consultants.find((x) => !x.isFlagship && x.offerings[0]);
    if (c) return { consultant: c, offering: c.offerings[0] };
  }
  if (key === "VIRTUAL_PRUDENT_TEAM") {
    for (const c of consultants) {
      const offering = c.offerings.find(
        (o) => o.isActive && o.deliveryMode === DeliveryMode.VIRTUAL_WITH_PRUDENT,
      );
      if (offering) return { consultant: c, offering };
    }
    const flagship = consultants.find((x) => x.isFlagship && x.offerings[0]);
    if (flagship) return { consultant: flagship, offering: flagship.offerings[0] };
  }
  return null;
}

export function getOfferingTypeLabel(key: OfferingTypeKey | string | null | undefined): string {
  if (!key) return "Consultation";
  const labels: Record<OfferingTypeKey, string> = {
    PHYSICAL_PRUDENT_TEAM: "Physical · Mrs. Prudent + Team",
    PHYSICAL_TEAM_ONLY: "Physical · Creative Team",
    VIRTUAL_PRUDENT_TEAM: "Virtual · Mrs. Prudent + Team",
    VIRTUAL_TEAM_ONLY: "Virtual · Creative Team",
  };
  return labels[key as OfferingTypeKey] ?? key;
}

export function getOfferingTypeIcon(key: OfferingTypeKey | string | null | undefined): string {
  if (!key) return "";
  if (key.startsWith("VIRTUAL")) return "💻";
  if (key.startsWith("PHYSICAL")) return "🏛";
  return "";
}

export function getVirtualPlatformLabel(id: string | null | undefined): string {
  if (!id) return "";
  const found = VIRTUAL_PLATFORMS.find((p) => p.id === id);
  return found?.label ?? id.replace(/_/g, " ");
}

export function includesMrsPrudent(key: OfferingTypeKey | string | null | undefined): boolean {
  return key === "PHYSICAL_PRUDENT_TEAM" || key === "VIRTUAL_PRUDENT_TEAM";
}
