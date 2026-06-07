import { JobEditorClient } from "@/components/admin/careers/JobEditorClient";

export default function AdminCareersNewPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">New job posting</h1>
      <JobEditorClient />
    </div>
  );
}
