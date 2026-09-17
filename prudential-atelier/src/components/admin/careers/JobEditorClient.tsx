"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JobPosting, JobType } from "@prisma/client";
import toast from "react-hot-toast";
import { CmsRichTextEditor } from "@/components/admin/content/CmsRichTextEditor";
import { Toggle } from "@/components/ui/Toggle";
import { CustomFieldBuilder } from "@/components/admin/careers/CustomFieldBuilder";
import { parseCustomFields, type CustomField } from "@/lib/job-custom-fields";
import { cn, slugifyText } from "@/lib/utils";
import { apiErrorMessage, focusField, isEmptyRichText, plainTextFromHtml } from "@/lib/form-errors";

const JOB_TYPES: JobType[] = ["FULL_TIME", "PART_TIME", "FREELANCE", "INTERNSHIP", "IT_PLACEMENT"];

type FieldKey = "title" | "department" | "location" | "description" | "requirements";

export function JobEditorClient({ job }: { job?: JobPosting }) {
  const router = useRouter();
  const isEdit = Boolean(job);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(job?.title ?? "");
  const [department, setDepartment] = useState(job?.department ?? "");
  const [type, setType] = useState<JobType>(job?.type ?? "FULL_TIME");
  const [location, setLocation] = useState(job?.location ?? "Lagos, Nigeria");
  const [salaryRange, setSalaryRange] = useState(job?.salaryRange ?? "");
  const [deadline, setDeadline] = useState(
    job?.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : "",
  );
  const [isPFAPosition, setIsPFAPosition] = useState(job?.isPFAPosition ?? false);
  const [description, setDescription] = useState(job?.description ?? "<p></p>");
  const [requirements, setRequirements] = useState(job?.requirements ?? "<p></p>");
  const [benefits, setBenefits] = useState(job?.benefits ?? "");
  const [customFields, setCustomFields] = useState<CustomField[]>(parseCustomFields(job?.customFields));
  const [isPublished, setIsPublished] = useState(job?.isPublished ?? false);
  const [slug, setSlug] = useState(job?.slug ?? "");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  function clearError(key: FieldKey) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): FieldKey | null {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!title.trim()) next.title = "Add a job title";
    if (!department.trim()) next.department = "Add a department";
    if (!location.trim()) next.location = "Add a location";
    if (isEmptyRichText(description) || plainTextFromHtml(description).length < 10) {
      next.description = "Write a short description of the role (at least a sentence)";
    }
    if (isEmptyRichText(requirements) || plainTextFromHtml(requirements).length < 10) {
      next.requirements = "List what the role needs (at least a sentence)";
    }
    setFieldErrors(next);
    const order: FieldKey[] = ["title", "department", "location", "description", "requirements"];
    return order.find((k) => next[k]) ?? null;
  }

  async function save(publish: boolean) {
    const first = validate();
    if (first) {
      toast.error("Please complete the highlighted fields");
      focusField(`job-${first}`);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        department: department.trim(),
        type,
        location: location.trim(),
        description,
        requirements,
        benefits: benefits || null,
        salaryRange: salaryRange.trim() || null,
        deadline: deadline || null,
        isPFAPosition,
        customFields,
        isPublished: publish ? true : isPublished,
        slug: slug.trim() || slugifyText(title),
      };
      const res = await fetch(isEdit ? `/api/admin/careers/jobs/${job!.id}` : "/api/admin/careers/jobs", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        toast.error(apiErrorMessage(data, "Could not save job posting"));
        return;
      }
      toast.success(publish ? "Job published" : "Job saved");
      router.push("/admin/careers");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1 w-full min-h-[44px] rounded-sm border border-sand px-3 py-2 font-body text-sm outline-none focus:border-olive";
  const errorInput = "border-[var(--error)] focus:border-[var(--error)]";

  return (
    <div className="mt-6 max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2" data-field="job-title">
          <label htmlFor="job-title" className="font-body text-xs text-charcoal-mid">
            Job Title
          </label>
          <input
            id="job-title"
            className={cn(inputClass, fieldErrors.title && errorInput)}
            value={title}
            aria-invalid={fieldErrors.title ? true : undefined}
            onChange={(e) => {
              setTitle(e.target.value);
              clearError("title");
              if (!isEdit && !slug) setSlug(slugifyText(e.target.value));
            }}
          />
          {fieldErrors.title ? (
            <p role="alert" className="mt-1 font-body text-xs text-[var(--error)]">
              {fieldErrors.title}
            </p>
          ) : null}
        </div>
        <div data-field="job-department">
          <label htmlFor="job-department" className="font-body text-xs text-charcoal-mid">
            Department
          </label>
          <input
            id="job-department"
            className={cn(inputClass, fieldErrors.department && errorInput)}
            value={department}
            aria-invalid={fieldErrors.department ? true : undefined}
            onChange={(e) => {
              setDepartment(e.target.value);
              clearError("department");
            }}
          />
          {fieldErrors.department ? (
            <p role="alert" className="mt-1 font-body text-xs text-[var(--error)]">
              {fieldErrors.department}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="job-type" className="font-body text-xs text-charcoal-mid">
            Job Type
          </label>
          <select
            id="job-type"
            className={inputClass}
            value={type}
            onChange={(e) => setType(e.target.value as JobType)}
          >
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div data-field="job-location">
          <label htmlFor="job-location" className="font-body text-xs text-charcoal-mid">
            Location
          </label>
          <input
            id="job-location"
            className={cn(inputClass, fieldErrors.location && errorInput)}
            value={location}
            aria-invalid={fieldErrors.location ? true : undefined}
            onChange={(e) => {
              setLocation(e.target.value);
              clearError("location");
            }}
          />
          {fieldErrors.location ? (
            <p role="alert" className="mt-1 font-body text-xs text-[var(--error)]">
              {fieldErrors.location}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="job-salary" className="font-body text-xs text-charcoal-mid">
            Salary Range (optional)
          </label>
          <input
            id="job-salary"
            className={inputClass}
            value={salaryRange}
            onChange={(e) => setSalaryRange(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="job-deadline" className="font-body text-xs text-charcoal-mid">
            Application Deadline
          </label>
          <input
            id="job-deadline"
            type="date"
            className={inputClass}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="job-slug" className="font-body text-xs text-charcoal-mid">
            Slug
          </label>
          <input id="job-slug" className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-sm border border-sand p-4">
        <div>
          <p className="font-body text-sm text-charcoal">PFA Position</p>
          <p className="font-body text-xs text-charcoal-mid">Enable for IT/internship roles open to PFA students</p>
        </div>
        <Toggle checked={isPFAPosition} srLabel="PFA position" onChange={setIsPFAPosition} />
      </div>

      <div data-field="job-description" id="job-description">
        <p className="font-body text-xs text-charcoal-mid">Description</p>
        <div
          className={cn(
            "mt-1 rounded-sm",
            fieldErrors.description && "ring-2 ring-[var(--error)]/60",
          )}
        >
          <CmsRichTextEditor
            value={description}
            onChange={(v) => {
              setDescription(v);
              clearError("description");
            }}
          />
        </div>
        {fieldErrors.description ? (
          <p role="alert" className="mt-1 font-body text-xs text-[var(--error)]">
            {fieldErrors.description}
          </p>
        ) : null}
      </div>
      <div data-field="job-requirements" id="job-requirements">
        <p className="font-body text-xs text-charcoal-mid">Requirements</p>
        <div
          className={cn(
            "mt-1 rounded-sm",
            fieldErrors.requirements && "ring-2 ring-[var(--error)]/60",
          )}
        >
          <CmsRichTextEditor
            value={requirements}
            onChange={(v) => {
              setRequirements(v);
              clearError("requirements");
            }}
          />
        </div>
        {fieldErrors.requirements ? (
          <p role="alert" className="mt-1 font-body text-xs text-[var(--error)]">
            {fieldErrors.requirements}
          </p>
        ) : null}
      </div>
      <div>
        <p className="font-body text-xs text-charcoal-mid">Benefits</p>
        <div className="mt-1">
          <CmsRichTextEditor value={benefits || "<p></p>"} onChange={setBenefits} />
        </div>
      </div>

      <div>
        <p className="font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">Custom Fields</p>
        <div className="mt-3">
          <CustomFieldBuilder fields={customFields} onChange={setCustomFields} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-sm border border-sand p-4">
        <span className="font-body text-sm text-charcoal">Published</span>
        <Toggle checked={isPublished} srLabel="Published" onChange={setIsPublished} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save(false)}
          className="min-h-[44px] rounded-sm border border-sand px-4 py-2 font-body text-sm"
        >
          Save as draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save(true)}
          className="min-h-[44px] rounded-sm bg-choc px-4 py-2 font-label text-[11px] font-semibold uppercase tracking-wide text-cream"
        >
          Publish job
        </button>
      </div>
    </div>
  );
}
