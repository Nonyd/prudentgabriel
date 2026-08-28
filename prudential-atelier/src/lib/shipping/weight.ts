export const DHL_VOLUMETRIC_DIVISOR = 5000;

export type ParcelDims = {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type PackagingLike = {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

const FALLBACK_GARMENT: ParcelDims = {
  weightKg: 0.5,
  lengthCm: 40,
  widthCm: 30,
  heightCm: 12,
};

export function volumetricKg(dims: Pick<ParcelDims, "lengthCm" | "widthCm" | "heightCm">, divisor = DHL_VOLUMETRIC_DIVISOR): number {
  const vol = (dims.lengthCm * dims.widthCm * dims.heightCm) / divisor;
  return Number.isFinite(vol) && vol > 0 ? vol : 0;
}

/** Billable weight is the greater of actual and volumetric. DHL invoices volumetric on a bulky gown. */
export function billableKg(parcel: ParcelDims, divisor = DHL_VOLUMETRIC_DIVISOR): number {
  const actual = Math.max(0, parcel.weightKg);
  const vol = volumetricKg(parcel, divisor);
  return Math.max(actual, vol, 0.1);
}

export function mergeParcel(params: {
  variant?: Partial<ParcelDims> | null;
  product?: Partial<ParcelDims> | null;
  packaging?: PackagingLike | null;
  quantity: number;
}): ParcelDims {
  const qty = Math.max(1, params.quantity);
  const garment: ParcelDims = {
    weightKg: params.variant?.weightKg ?? params.product?.weightKg ?? FALLBACK_GARMENT.weightKg,
    lengthCm: params.variant?.lengthCm ?? params.product?.lengthCm ?? FALLBACK_GARMENT.lengthCm,
    widthCm: params.variant?.widthCm ?? params.product?.widthCm ?? FALLBACK_GARMENT.widthCm,
    heightCm: params.variant?.heightCm ?? params.product?.heightCm ?? FALLBACK_GARMENT.heightCm,
  };
  const box = params.packaging;
  if (!box) {
    return {
      weightKg: garment.weightKg * qty,
      lengthCm: garment.lengthCm,
      widthCm: garment.widthCm,
      heightCm: garment.heightCm * (qty > 1 ? Math.min(qty, 3) : 1),
    };
  }
  return {
    weightKg: garment.weightKg * qty + box.weightKg,
    lengthCm: Math.max(garment.lengthCm, box.lengthCm),
    widthCm: Math.max(garment.widthCm, box.widthCm),
    heightCm: Math.max(garment.heightCm, box.heightCm),
  };
}

export function combineParcels(parcels: ParcelDims[]): ParcelDims {
  if (parcels.length === 0) return { ...FALLBACK_GARMENT };
  return parcels.reduce(
    (acc, p) => ({
      weightKg: acc.weightKg + p.weightKg,
      lengthCm: Math.max(acc.lengthCm, p.lengthCm),
      widthCm: Math.max(acc.widthCm, p.widthCm),
      heightCm: acc.heightCm + p.heightCm,
    }),
    { weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0 },
  );
}
