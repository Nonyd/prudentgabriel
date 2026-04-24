"use client";

import { useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Coupon, ProductCategory } from "@prisma/client";
import { ProductCategory as PC } from "@prisma/client";
import toast from "react-hot-toast";
import { X, Lock } from "lucide-react";

const formSchema = z
  .object({
    code: z.string().min(3).max(30),
    description: z.string().optional(),
    type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
    value: z.number().min(0),
    minOrderNGN: z.number().optional(),
    maxUsesTotal: z.number().int().optional().nullable(),
    maxUsesPerUser: z.number().int().min(1),
    appliesToAll: z.boolean(),
    categoryScope: z.array(z.nativeEnum(PC)),
    isActive: z.boolean(),
    startsAt: z.string(),
    expiresAt: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "PERCENTAGE" && data.value > 100) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Max 100%" });
    }
  });

type FormValues = z.infer<typeof formSchema>;

const CATEGORIES: ProductCategory[] = [
  PC.BRIDAL,
  PC.EVENING_WEAR,
  PC.FORMAL,
  PC.CASUAL,
  PC.KIDDIES,
  PC.ACCESSORIES,
];

function toYmd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function CouponFormModal({
  open,
  onOpenChange,
  coupon,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  coupon: Coupon | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(coupon);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      description: "",
      type: "PERCENTAGE",
      value: 10,
      minOrderNGN: undefined,
      maxUsesTotal: null,
      maxUsesPerUser: 1,
      appliesToAll: true,
      categoryScope: [],
      isActive: true,
      startsAt: toYmd(new Date()),
      expiresAt: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (coupon) {
      form.reset({
        code: coupon.code,
        description: coupon.description ?? "",
        type: coupon.type,
        value: coupon.value,
        minOrderNGN: coupon.minOrderNGN ?? undefined,
        maxUsesTotal: coupon.maxUsesTotal,
        maxUsesPerUser: coupon.maxUsesPerUser,
        appliesToAll: coupon.appliesToAll,
        categoryScope: (coupon.categoryScope ?? []) as ProductCategory[],
        isActive: coupon.isActive,
        startsAt: toYmd(new Date(coupon.startsAt)),
        expiresAt: coupon.expiresAt ? toYmd(new Date(coupon.expiresAt)) : "",
      });
    } else {
      form.reset({
        code: "",
        description: "",
        type: "PERCENTAGE",
        value: 10,
        minOrderNGN: undefined,
        maxUsesTotal: null,
        maxUsesPerUser: 1,
        appliesToAll: true,
        categoryScope: [],
        isActive: true,
        startsAt: toYmd(new Date()),
        expiresAt: "",
      });
    }
  }, [open, coupon, form]);

  const type = form.watch("type");
  const appliesToAll = form.watch("appliesToAll");

  const checkCode = async () => {
    const code = form.getValues("code").trim().toUpperCase();
    if (isEdit || code.length < 3) return;
    const res = await fetch(`/api/admin/coupons/check?code=${encodeURIComponent(code)}`);
    const j = (await res.json()) as { exists?: boolean };
    if (j.exists) form.setError("code", { message: "Code already exists" });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const maxTotal =
      values.maxUsesTotal != null && Number.isFinite(values.maxUsesTotal) ? values.maxUsesTotal : undefined;
    const body: Record<string, unknown> = {
      description: values.description || undefined,
      type: values.type,
      value: values.type === "FREE_SHIPPING" ? 0 : values.value,
      minOrderNGN: values.minOrderNGN,
      maxUsesTotal: maxTotal,
      maxUsesPerUser: values.maxUsesPerUser,
      appliesToAll: values.appliesToAll,
      categoryScope: values.appliesToAll ? [] : values.categoryScope,
      isActive: values.isActive,
      startsAt: new Date(values.startsAt).toISOString(),
      expiresAt: values.expiresAt?.trim() ? new Date(values.expiresAt).toISOString() : null,
    };
    if (!isEdit) {
      body.code = values.code.toUpperCase();
    }

    const url = isEdit ? `/api/admin/coupons/${coupon!.id}` : "/api/admin/coupons";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error((j as { error?: string }).error ?? "Save failed");
      return;
    }
    toast.success(isEdit ? "Coupon updated ✓" : "Coupon created ✓");
    onOpenChange(false);
    onSaved();
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[121] max-h-[90vh] w-[min(96vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-[#EBEBEA] bg-white p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-display text-[22px] text-black">
              {isEdit ? "Edit coupon" : "Create coupon"}
            </Dialog.Title>
            <Dialog.Close className="text-charcoal hover:text-black" aria-label="Close">
              <X size={20} />
            </Dialog.Close>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="font-body text-[11px] uppercase text-[#6B6B68]">Code</label>
              <div className="mt-1 flex gap-2">
                <input
                  {...form.register("code")}
                  disabled={isEdit}
                  onBlur={() => void checkCode()}
                  className="min-w-0 flex-1 border border-[#EBEBEA] px-3 py-2 font-mono text-sm uppercase disabled:bg-[#F5F5F3]"
                />
                {isEdit ? <Lock className="mt-2 h-4 w-4 text-[#A8A8A4]" aria-hidden /> : null}
                {!isEdit ? (
                  <button
                    type="button"
                    className="shrink-0 border border-[#EBEBEA] px-3 py-2 font-body text-[11px] uppercase"
                    onClick={() => {
                      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
                      let s = "";
                      for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
                      form.setValue("code", s);
                    }}
                  >
                    Random
                  </button>
                ) : null}
              </div>
              {form.formState.errors.code ? (
                <p className="mt-1 font-body text-xs text-red-700">{form.formState.errors.code.message}</p>
              ) : null}
            </div>

            <div>
              <label className="font-body text-[11px] uppercase text-[#6B6B68]">Description (optional)</label>
              <input {...form.register("description")} className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 text-sm" />
            </div>

            <div>
              <p className="font-body text-[11px] uppercase text-[#6B6B68]">Discount type</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"] as const).map((t) => (
                  <label
                    key={t}
                    className={`cursor-pointer border p-3 text-center font-body text-[11px] uppercase ${
                      type === t ? "border-[#37392d] ring-1 ring-[#37392d]" : "border-[#EBEBEA]"
                    }`}
                  >
                    <input type="radio" value={t} {...form.register("type")} className="sr-only" />
                    {t === "PERCENTAGE" ? "%" : t === "FIXED_AMOUNT" ? "₦" : "Ship"}
                  </label>
                ))}
              </div>
            </div>

            {type !== "FREE_SHIPPING" ? (
              <div>
                <label className="font-body text-[11px] uppercase text-[#6B6B68]">Value</label>
                <input
                  type="number"
                  step="0.01"
                  {...form.register("value", { valueAsNumber: true })}
                  className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 text-sm"
                />
                {form.formState.errors.value ? (
                  <p className="mt-1 text-xs text-red-700">{form.formState.errors.value.message}</p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="font-body text-[11px] uppercase text-[#6B6B68]">Min order (₦, optional)</label>
              <input
                type="number"
                {...form.register("minOrderNGN", { valueAsNumber: true })}
                className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-body text-[11px] uppercase text-[#6B6B68]">Max total uses</label>
                <input
                  type="number"
                  {...form.register("maxUsesTotal", { valueAsNumber: true })}
                  className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 text-sm"
                  placeholder="∞"
                />
              </div>
              <div>
                <label className="font-body text-[11px] uppercase text-[#6B6B68]">Max per customer</label>
                <input
                  type="number"
                  {...form.register("maxUsesPerUser", { valueAsNumber: true })}
                  className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 font-body text-sm">
                <input type="checkbox" {...form.register("appliesToAll")} />
                All products
              </label>
              {!appliesToAll ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <label key={c} className="flex items-center gap-1 font-body text-xs">
                      <input
                        type="checkbox"
                        checked={form.watch("categoryScope").includes(c)}
                        onChange={(e) => {
                          const cur = form.getValues("categoryScope");
                          form.setValue(
                            "categoryScope",
                            e.target.checked ? [...cur, c] : cur.filter((x) => x !== c),
                          );
                        }}
                      />
                      {c.replace(/_/g, " ")}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-body text-[11px] uppercase text-[#6B6B68]">Start</label>
                <input type="date" {...form.register("startsAt")} className="mt-1 w-full border border-[#EBEBEA] px-2 py-2 text-sm" />
              </div>
              <div>
                <label className="font-body text-[11px] uppercase text-[#6B6B68]">End (optional)</label>
                <input type="date" {...form.register("expiresAt")} className="mt-1 w-full border border-[#EBEBEA] px-2 py-2 text-sm" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  className="border border-[#EBEBEA] px-2 py-1 font-body text-[10px] uppercase"
                  onClick={() => {
                    const end = new Date();
                    end.setDate(end.getDate() + d);
                    form.setValue("expiresAt", toYmd(end));
                  }}
                >
                  +{d}d
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 font-body text-sm">
              <input type="checkbox" {...form.register("isActive")} />
              Coupon is active
            </label>

            <div className="flex justify-end gap-2 border-t border-[#EBEBEA] pt-4">
              <Dialog.Close asChild>
                <button type="button" className="border border-[#EBEBEA] px-6 py-2 text-xs uppercase">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="bg-[#37392d] px-6 py-2 text-xs uppercase text-white disabled:opacity-50"
              >
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
