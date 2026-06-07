"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { JobPosting } from "@prisma/client";
import type { PFAStudentInfo } from "@/lib/pfa-verify";
import { parseCustomFields, type CustomResponses } from "@/lib/job-custom-fields";
import { PFAVerificationBlock } from "@/components/careers/PFAVerificationBlock";
import { CustomFieldsRenderer } from "@/components/careers/CustomFieldsRenderer";

const EXP_OPTIONS = [
  { label: "0–1", value: 0 },
  { label: "1–3", value: 2 },
  { label: "3–5", value: 4 },
  { label: "5–10", value: 7 },
  { label: "10+", value: 10 },
] as const;

const HEARD_FROM = ["Instagram", "TikTok", "Referral", "LinkedIn", "Job board", "Other"];

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/careers/upload", { method: "POST", body: form });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
  return data.url;
}

export function JobApplicationForm({ job }: { job: JobPosting }) {
  const router = useRouter();
  const customFields = parseCustomFields(job.customFields);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [yearsOfExp, setYearsOfExp] = useState<number | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [portfolioFile, setPortfolioFile] = useState<string | null>(null);
  const [heardFrom, setHeardFrom] = useState("");
  const [customResponses, setCustomResponses] = useState<CustomResponses>({});
  const [pfaRegNumber, setPfaRegNumber] = useState("");
  const [pfaInfo, setPfaInfo] = useState<PFAStudentInfo | null>(null);
  const [universityName, setUniversityName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorEmail, setSupervisorEmail] = useState("");
  const [supervisorPhone, setSupervisorPhone] = useState("");
  const [itDuration, setItDuration] = useState("");
  const [itStartDate, setItStartDate] = useState("");
  const [schoolItLetter, setSchoolItLetter] = useState<string | null>(null);
  const [schoolIdCard, setSchoolIdCard] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cvUrl) {
      toast.error("Please upload your CV");
      return;
    }
    if (job.isPFAPosition && !pfaInfo?.valid) {
      toast.error("Please verify your PFA registration number");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/careers/${job.slug}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          yearsOfExp,
          coverLetter: coverLetter.trim() || null,
          cvUrl,
          portfolioUrl: portfolioFile || portfolioUrl.trim() || null,
          heardFrom: heardFrom || null,
          customResponses,
          pfaRegNumber: job.isPFAPosition ? pfaRegNumber : null,
          pfaVerified: job.isPFAPosition ? pfaInfo?.valid : false,
          pfaStudentName: pfaInfo?.name ?? null,
          pfaCourse: pfaInfo?.course ?? null,
          pfaYear: pfaInfo?.year ?? null,
          universityName: job.isPFAPosition ? universityName : null,
          supervisorName: job.isPFAPosition ? supervisorName : null,
          supervisorEmail: job.isPFAPosition ? supervisorEmail : null,
          supervisorPhone: job.isPFAPosition ? supervisorPhone : null,
          itDuration: job.isPFAPosition ? itDuration : null,
          itStartDate: job.isPFAPosition && itStartDate ? itStartDate : null,
          schoolItLetter: job.isPFAPosition ? schoolItLetter : null,
          schoolIdCard: job.isPFAPosition ? schoolIdCard : null,
        }),
      });
      const data = (await res.json()) as { error?: string; applicationId?: string };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not submit application");
        return;
      }
      toast.success("Application submitted successfully");
      router.push(`/careers/${job.slug}?applied=1`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-[3px] border border-sand bg-input-bg px-3 py-2 font-body text-sm text-choc outline-none focus:border-lightbr";

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-5">
      {job.isPFAPosition ? (
        <>
          <PFAVerificationBlock
            regNumber={pfaRegNumber}
            onRegNumberChange={setPfaRegNumber}
            verified={pfaInfo}
            onVerified={setPfaInfo}
            disabled={submitting}
          />
          {pfaInfo?.valid ? (
            <div className="space-y-4 border-t border-sand pt-4">
              <div>
                <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">University</label>
                <input className={inputClass} value={universityName} onChange={(e) => setUniversityName(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">IT duration</label>
                  <input className={inputClass} value={itDuration} onChange={(e) => setItDuration(e.target.value)} placeholder="6 months" />
                </div>
                <div>
                  <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">IT start date</label>
                  <input type="date" className={inputClass} value={itStartDate} onChange={(e) => setItStartDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">Supervisor name</label>
                <input className={inputClass} value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">Supervisor email</label>
                  <input type="email" className={inputClass} value={supervisorEmail} onChange={(e) => setSupervisorEmail(e.target.value)} />
                </div>
                <div>
                  <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">Supervisor phone</label>
                  <input className={inputClass} value={supervisorPhone} onChange={(e) => setSupervisorPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">School IT letter (PDF)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  className="mt-2 font-body text-sm"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setSchoolItLetter(await uploadFile(f));
                  }}
                />
              </div>
              <div>
                <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">School ID card (PDF/image)</label>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="mt-2 font-body text-sm"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setSchoolIdCard(await uploadFile(f));
                  }}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div>
        <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">Full Name *</label>
        <input required className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div>
        <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">Email Address *</label>
        <input required type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">Phone Number *</label>
        <input required className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div>
        <p className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">Years of Experience</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXP_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setYearsOfExp(opt.value)}
              className={`rounded-full border px-3 py-1 font-body text-xs ${
                yearsOfExp === opt.value ? "border-lightbr bg-lightbr text-cream" : "border-sand text-choc"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">CV / Resume *</label>
        <input
          type="file"
          accept="application/pdf"
          required={!cvUrl}
          className="mt-2 font-body text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setCvUrl(await uploadFile(f));
            } catch {
              toast.error("CV upload failed");
            }
          }}
        />
        <p className="mt-1 font-body text-xs text-text-light">Max 5MB · PDF only</p>
        {cvUrl ? <p className="font-body text-xs text-green-800">CV uploaded ✓</p> : null}
      </div>

      <div>
        <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">Portfolio (optional)</label>
        <input
          type="file"
          accept="application/pdf"
          className="mt-2 block font-body text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setPortfolioFile(await uploadFile(f));
          }}
        />
        <input
          className={`${inputClass} mt-2`}
          placeholder="Or paste URL"
          value={portfolioUrl}
          onChange={(e) => setPortfolioUrl(e.target.value)}
        />
      </div>

      <div>
        <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">How did you hear about us?</label>
        <select className={inputClass} value={heardFrom} onChange={(e) => setHeardFrom(e.target.value)}>
          <option value="">Select…</option>
          {HEARD_FROM.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">Cover Letter</label>
        <textarea
          className={inputClass}
          rows={4}
          maxLength={1000}
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
        />
        <p className="mt-1 text-right font-body text-xs text-text-light">{coverLetter.length}/1000</p>
      </div>

      {customFields.length > 0 ? (
        <CustomFieldsRenderer fields={customFields} values={customResponses} onChange={setCustomResponses} disabled={submitting} />
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-[3px] bg-choc py-3 font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-cream disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Application →"}
      </button>
    </form>
  );
}
