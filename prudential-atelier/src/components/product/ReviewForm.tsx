"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  body: z.string().min(10, "Please write at least 10 characters"),
});

type Form = z.infer<typeof schema>;

export function ReviewForm({
  productId,
  onDone,
}: {
  productId: string;
  onDone: () => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { rating: 5, body: "", title: "" },
  });

  const rating = watch("rating");

  const onSubmit = async (data: Form) => {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        rating: data.rating,
        title: data.title || undefined,
        body: data.body,
      }),
    });
    if (!res.ok) {
      toast.error("Could not submit review.");
      return;
    }
    toast.success("Review submitted for approval ✓");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <p className="mb-2 font-label text-xs uppercase text-charcoal-mid">Rating</p>
        <StarRating rating={rating} interactive size="md" onChange={(r) => setValue("rating", r)} />
      </div>
      <div>
        <label className="font-label text-xs uppercase text-charcoal-mid">Title (optional)</label>
        <input
          className="mt-1 w-full rounded-sm border border-border px-3 py-2 text-sm"
          {...register("title")}
        />
      </div>
      <div>
        <label className="font-label text-xs uppercase text-charcoal-mid">Your review</label>
        <textarea
          className="mt-1 min-h-[100px] w-full rounded-sm border border-border px-3 py-2 text-sm"
          {...register("body")}
        />
        {errors.body && <p className="mt-1 text-xs text-error">{errors.body.message}</p>}
      </div>
      <Button type="submit" loading={isSubmitting}>
        Submit
      </Button>
    </form>
  );
}
