"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JobPosting, JobType } from "@prisma/client";
import toast from "react-hot-toast";
import { CmsRichTextEditor } from "@/components/admin/content/CmsRichTextEditor";
import { Toggle } from "@/components/ui/Toggle";
import { CustomFieldBuilder } from "@/components/admin/careers/CustomFieldBuilder";
import { parseCustomFields, type CustomField } from "@/lib/job-custom-fields";
import { slugifyText } from "@/lib/utils";

const JOB_TYPES: JobType[] = ["FULL_TIME", "PART_TIME", "FREELANCE", "INTERNSHIP", "IT_PLACEMENT"];

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

  async function save(publish: boolean) {
    if (!title.trim() || !department.trim()) {
      toast.error("Title and department are required");
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
      if (!res.ok) {
        toast.error("Could not save job posting");
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
    "mt-1 w-full rounded-sm border border-sand px-3 py-2 font-body text-sm outline-none focus:border-olive";

  return (
    <div className="mt-6 max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="font-body text-xs text-charcoal-mid">Job Title</label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!isEdit && !slug) setSlug(slugifyText(e.target.value));
            }}
          />
        </div>
        <div>
          <label className="font-body text-xs text-charcoal-mid">Department</label>
          <input className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </div>
        <div>
          <label className="font-body text-xs text-charcoal-mid">Job Type</label>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as JobType)}>
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-body text-xs text-charcoal-mid">Location</label>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <label className="font-body text-xs text-charcoal-mid">Salary Range (optional)</label>
          <input className={inputClass} value={salaryRange} onChange={(e) => setSalaryRange(e.target.value)} />
        </div>
        <div>
          <label className="font-body text-xs text-charcoal-mid">Application Deadline</label>
          <input type="date" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="font-body text-xs text-charcoal-mid">Slug</label>
          <input className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-sm border border-sand p-4">
        <div>
          <p className="font-body text-sm text-charcoal">PFA Position</p>
          <p className="font-body text-xs text-charcoal-mid">Enable for IT/internship roles open to PFA students</p>
        </div>
        <Toggle checked={isPFAPosition} srLabel="PFA position" onChange={setIsPFAPosition} />
      </div>

      <div>
        <p className="font-body text-xs text-charcoal-mid">Description</p>
        <div className="mt-1">
          <CmsRichTextEditor value={description} onChange={setDescription} />
        </div>
      </div>
      <div>
        <p className="font-body text-xs text-charcoal-mid">Requirements</p>
        <div className="mt-1">
          <CmsRichTextEditor value={requirements} onChange={setRequirements} />
        </div>
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
          className="rounded-sm border border-sand px-4 py-2 font-body text-sm"
        >
          Save as draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save(true)}
          className="rounded-sm bg-choc px-4 py-2 font-label text-[11px] font-semibold uppercase tracking-wide text-cream"
        >
          Publish job
        </button>
      </div>
    </div>
  );
}
