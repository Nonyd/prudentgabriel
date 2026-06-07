"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import type { ApplicationEmail, ApplicationStatus, JobApplication, JobPosting } from "@prisma/client";
import toast from "react-hot-toast";
import { parseCustomFields, type CustomResponses } from "@/lib/job-custom-fields";

type ApplicationDetail = JobApplication & {
  job: JobPosting;
  emailsSent: ApplicationEmail[];
};

const STATUSES: ApplicationStatus[] = [
  "NEW",
  "REVIEWED",
  "SHORTLISTED",
  "INTERVIEWED",
  "REJECTED",
  "HIRED",
];

export function ApplicationDetailClient({ application }: { application: ApplicationDetail }) {
  const router = useRouter();
  const [status, setStatus] = useState(application.status);
  const [adminNotes, setAdminNotes] = useState(application.adminNotes ?? "");
  const [sendStatusEmail, setSendStatusEmail] = useState(true);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [busy, setBusy] = useState(false);

  const customFields = parseCustomFields(application.job.customFields);
  const responses = (application.customResponses ?? {}) as CustomResponses;

  async function saveStatus() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/careers/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, adminNotes, sendStatusEmail }),
      });
      if (!res.ok) {
        toast.error("Could not update application");
        return;
      }
      toast.success("Application updated");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Subject and body are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/careers/applications/${application.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject: emailSubject, body: emailBody }),
      });
      if (!res.ok) {
        toast.error("Could not send email");
        return;
      }
      toast.success("Email sent");
      setEmailSubject("");
      setEmailBody("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-sm border border-[#EBEBEA] bg-canvas p-5">
          <p className="font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">Applicant</p>
          <p className="mt-2 font-display text-xl text-ink">{application.fullName}</p>
          <p className="font-body text-sm text-charcoal-mid">{application.email}</p>
          <p className="font-body text-sm text-charcoal-mid">{application.phone}</p>
          {application.yearsOfExp != null ? (
            <p className="mt-2 font-body text-sm">{application.yearsOfExp}+ years experience</p>
          ) : null}
          {application.isPFAApplication && application.pfaVerified ? (
            <div className="mt-4 rounded-sm bg-green-50 p-3 font-body text-sm text-green-900">
              PFA Verified ✓
              <br />
              {application.pfaRegNumber}
              <br />
              {application.pfaStudentName} · {application.pfaCourse} · Y{application.pfaYear}
              {application.universityName ? <br /> : null}
              {application.universityName ? `University: ${application.universityName}` : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-sm border border-[#EBEBEA] bg-canvas p-5 space-y-4">
          <div>
            <label className="font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
              className="mt-2 w-full rounded-sm border border-[#EBEBEA] px-3 py-2 font-body text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <label className="mt-2 flex items-center gap-2 font-body text-xs">
              <input type="checkbox" checked={sendStatusEmail} onChange={(e) => setSendStatusEmail(e.target.checked)} />
              Send status email to applicant
            </label>
          </div>
          <div>
            <label className="font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">Admin notes</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-sm border border-[#EBEBEA] px-3 py-2 font-body text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveStatus()}
              className="mt-2 rounded-sm bg-olive px-3 py-1.5 font-body text-xs text-white"
            >
              Save
            </button>
          </div>
          <div>
            <p className="font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">Send email</p>
            <input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Subject"
              className="mt-2 w-full rounded-sm border border-[#EBEBEA] px-3 py-2 font-body text-sm"
            />
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={4}
              placeholder="Message"
              className="mt-2 w-full rounded-sm border border-[#EBEBEA] px-3 py-2 font-body text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendEmail()}
              className="mt-2 rounded-sm border border-choc px-3 py-1.5 font-body text-xs text-choc"
            >
              Send email →
            </button>
          </div>
        </div>
      </div>

      {application.coverLetter ? (
        <section className="rounded-sm border border-[#EBEBEA] bg-canvas p-5">
          <p className="font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">Cover letter</p>
          <p className="mt-2 whitespace-pre-wrap font-body text-sm text-charcoal">{application.coverLetter}</p>
        </section>
      ) : null}

      <section className="rounded-sm border border-[#EBEBEA] bg-canvas p-5">
        <p className="font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">Documents</p>
        <div className="mt-3 flex flex-wrap gap-4">
          {application.cvUrl ? (
            <a href={application.cvUrl} target="_blank" rel="noreferrer" className="font-body text-sm text-olive hover:underline">
              📄 Download CV
            </a>
          ) : null}
          {application.portfolioUrl ? (
            <a href={application.portfolioUrl} target="_blank" rel="noreferrer" className="font-body text-sm text-olive hover:underline">
              📄 Download Portfolio
            </a>
          ) : null}
          {application.schoolItLetter ? (
            <a href={application.schoolItLetter} target="_blank" rel="noreferrer" className="font-body text-sm text-olive hover:underline">
              📄 IT Letter
            </a>
          ) : null}
          {application.schoolIdCard ? (
            <a href={application.schoolIdCard} target="_blank" rel="noreferrer" className="font-body text-sm text-olive hover:underline">
              📄 School ID
            </a>
          ) : null}
        </div>
      </section>

      {customFields.length > 0 ? (
        <section className="rounded-sm border border-[#EBEBEA] bg-canvas p-5">
          <p className="font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">Custom field responses</p>
          <dl className="mt-3 space-y-2">
            {customFields
              .filter((f) => f.type !== "section_heading")
              .map((f) => (
                <div key={f.id}>
                  <dt className="font-body text-xs text-charcoal-mid">{f.label}</dt>
                  <dd className="font-body text-sm text-charcoal">
                    {Array.isArray(responses[f.id])
                      ? (responses[f.id] as string[]).join(", ")
                      : String(responses[f.id] ?? "—")}
                  </dd>
                </div>
              ))}
          </dl>
        </section>
      ) : null}

      {application.emailsSent.length > 0 ? (
        <section className="rounded-sm border border-[#EBEBEA] bg-canvas p-5">
          <p className="font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">Email log</p>
          <ul className="mt-3 space-y-2">
            {application.emailsSent.map((e) => (
              <li key={e.id} className="font-body text-xs text-charcoal-mid">
                {format(new Date(e.sentAt), "MMM d, yyyy HH:mm")} — {e.subject}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
