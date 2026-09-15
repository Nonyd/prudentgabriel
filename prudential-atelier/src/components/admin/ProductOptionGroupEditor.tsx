"use client";

import { Controller, useFieldArray, type Control, type UseFormSetValue, type UseFormWatch } from "react-hook-form";
import { effectiveUnitNGN } from "@/lib/pricing";
import type { ProductAdminInput } from "@/validations/product";

type LibraryField = { id: string; key: string; label: string };

export function ProductOptionGroupEditor({
  control,
  watch,
  setValue,
  libraryFields,
  variants,
  isOnSale,
}: {
  control: Control<ProductAdminInput>;
  watch: UseFormWatch<ProductAdminInput>;
  setValue: UseFormSetValue<ProductAdminInput>;
  libraryFields: LibraryField[];
  variants: ProductAdminInput["variants"];
  isOnSale: boolean;
}) {
  const group = watch("optionGroup");
  const enabled = Boolean(group);
  const { fields, append, remove } = useFieldArray({
    control,
    name: "optionGroup.options",
  });

  const cheapestSize = variants.reduce<(typeof variants)[number] | null>((best, v) => {
    if (!best) return v;
    return effectiveUnitNGN(v, isOnSale) < effectiveUnitNGN(best, isOnSale) ? v : best;
  }, null);

  return (
    <div className="mt-8 border-t border-sand pt-6">
      <h3 className="font-display text-xl text-choc">A choice on this piece</h3>
      <p className="mt-1 text-xs text-[#A8A8A4]">
        Trousers or a skirt, a jacket or none. One adjustment on top of every size — not a second size chart.
      </p>
      <label className="mt-3 flex items-center justify-between gap-2 text-sm text-charcoal">
        This piece has a choice
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            if (e.target.checked) {
              setValue("optionGroup", {
                label: "Trousers or skirt",
                isRequired: true,
                includeInSku: true,
                sortOrder: 0,
                options: [
                  { label: "Trousers", priceAdjustmentNGN: 0, isDefault: true, sortOrder: 0, measurementFieldIds: [] },
                  { label: "Skirt", priceAdjustmentNGN: 0, isDefault: false, sortOrder: 1, measurementFieldIds: [] },
                ],
              });
            } else {
              setValue("optionGroup", null);
            }
          }}
        />
      </label>
      {enabled && group ? (
        <div className="mt-4 space-y-4">
          <label className="block text-xs uppercase text-[#A8A8A4]">
            What she is choosing
            <input
              value={group.label}
              onChange={(e) => setValue("optionGroup.label", e.target.value, { shouldDirty: true })}
              className="mt-2 w-full min-h-[44px] rounded-xl border border-sand bg-cream px-4 py-3 font-body text-base text-choc"
            />
          </label>
          <Controller
            control={control}
            name="optionGroup.isRequired"
            render={({ field }) => (
              <label className="flex items-center justify-between gap-2 text-sm text-charcoal">
                She must choose before adding
                <input
                  type="checkbox"
                  checked={Boolean(field.value)}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              </label>
            )}
          />
          <Controller
            control={control}
            name="optionGroup.includeInSku"
            render={({ field }) => (
              <label className="flex items-center justify-between gap-2 text-sm text-charcoal">
                Put the choice on the stock code
                <input
                  type="checkbox"
                  checked={Boolean(field.value)}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              </label>
            )}
          />
          <p className="text-[11px] text-[#A8A8A4]">
            The workroom needs to know which version to cut. Size code stays as it is; the choice is appended, e.g. PA-ALLUR-12-SKIRT.
          </p>
          <ul className="space-y-4">
            {fields.map((field, i) => {
              const adj = Number(watch(`optionGroup.options.${i}.priceAdjustmentNGN`) ?? 0);
              const resulting = cheapestSize ? effectiveUnitNGN(cheapestSize, isOnSale, adj) : adj;
              const ticks = watch(`optionGroup.options.${i}.measurementFieldIds`) ?? [];
              return (
                <li key={field.id} className="rounded-xl border border-sand bg-cream/60 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="min-w-[140px] flex-1 text-xs uppercase text-[#A8A8A4]">
                      Choice
                      <input
                        {...control.register(`optionGroup.options.${i}.label`)}
                        className="mt-1 w-full min-h-[44px] rounded-xl border border-sand bg-cream px-3 py-2 font-body text-sm text-choc"
                      />
                    </label>
                    <label className="w-36 text-xs uppercase text-[#A8A8A4]">
                      Adjustment ₦
                      <input
                        type="number"
                        {...control.register(`optionGroup.options.${i}.priceAdjustmentNGN`, { valueAsNumber: true })}
                        className="mt-1 w-full min-h-[44px] rounded-xl border border-sand bg-cream px-3 py-2 font-body text-sm text-choc"
                      />
                    </label>
                    <p className="pb-2 text-sm text-charcoal">
                      Resulting from ₦{Math.round(resulting).toLocaleString("en-NG")}
                    </p>
                    <Controller
                      control={control}
                      name={`optionGroup.options.${i}.isDefault`}
                      render={({ field: df }) => (
                        <label className="flex items-center gap-2 pb-2 text-sm text-charcoal">
                          <input
                            type="checkbox"
                            checked={Boolean(df.value)}
                            onChange={(e) => {
                              const opts = watch("optionGroup.options") ?? [];
                              setValue(
                                "optionGroup.options",
                                opts.map((o, idx) => ({ ...o, isDefault: idx === i ? e.target.checked : false })),
                                { shouldDirty: true },
                              );
                            }}
                          />
                          Default
                        </label>
                      )}
                    />
                    {fields.length > 2 ? (
                      <button type="button" className="min-h-[44px] text-wine" onClick={() => remove(i)}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {libraryFields.length > 0 ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs uppercase tracking-wide text-[#A8A8A4]">
                        Measurements for this choice
                      </summary>
                      <p className="mt-1 text-[11px] text-[#A8A8A4]">
                        Leave empty to use the piece&apos;s usual fields. Tick a set here and made-to-measure asks only those.
                      </p>
                      <ul className="mt-2 space-y-2">
                        {libraryFields.map((f) => {
                          const selected = ticks.find((m) => m.fieldId === f.id);
                          return (
                            <li key={f.id} className="flex items-center justify-between gap-2 text-sm text-charcoal">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={Boolean(selected)}
                                  onChange={(e) => {
                                    const cur = watch(`optionGroup.options.${i}.measurementFieldIds`) ?? [];
                                    setValue(
                                      `optionGroup.options.${i}.measurementFieldIds`,
                                      e.target.checked
                                        ? [...cur, { fieldId: f.id, required: true, sortOrder: cur.length }]
                                        : cur.filter((m) => m.fieldId !== f.id),
                                      { shouldDirty: true },
                                    );
                                  }}
                                />
                                {f.label}
                              </label>
                              {selected ? (
                                <label className="flex items-center gap-1 text-xs">
                                  Required
                                  <input
                                    type="checkbox"
                                    checked={selected.required}
                                    onChange={(e) => {
                                      const cur = watch(`optionGroup.options.${i}.measurementFieldIds`) ?? [];
                                      setValue(
                                        `optionGroup.options.${i}.measurementFieldIds`,
                                        cur.map((m) =>
                                          m.fieldId === f.id ? { ...m, required: e.target.checked } : m,
                                        ),
                                        { shouldDirty: true },
                                      );
                                    }}
                                  />
                                </label>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center font-sans text-xs uppercase tracking-[0.14em] text-choc"
            onClick={() =>
              append({
                label: "",
                priceAdjustmentNGN: 0,
                isDefault: false,
                sortOrder: fields.length,
                measurementFieldIds: [],
              })
            }
          >
            Add a choice
          </button>
        </div>
      ) : null}
    </div>
  );
}
