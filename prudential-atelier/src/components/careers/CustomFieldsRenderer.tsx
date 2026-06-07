"use client";

import type { CustomField, CustomResponses, FieldType } from "@/lib/job-custom-fields";

async function uploadCareerFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/careers/upload", { method: "POST", body: form });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
  return data.url;
}

type Props = {
  fields: CustomField[];
  values: CustomResponses;
  onChange: (next: CustomResponses) => void;
  disabled?: boolean;
};

export function CustomFieldsRenderer({ fields, values, onChange, disabled }: Props) {
  function setValue(fieldId: string, value: CustomResponses[string]) {
    onChange({ ...values, [fieldId]: value });
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        if (field.type === "section_heading") {
          return (
            <p
              key={field.id}
              className="border-t border-sand pt-4 font-label text-[10px] uppercase tracking-[0.16em] text-lightbr"
            >
              {field.label}
            </p>
          );
        }

        const value = values[field.id];
        const label = (
          <label className="block font-label text-[10px] uppercase tracking-[0.16em] text-lightbr">
            {field.label}
            {field.required ? " *" : ""}
          </label>
        );
        const help = field.helpText ? (
          <p className="mt-1 font-body text-xs text-text-light">{field.helpText}</p>
        ) : null;

        return (
          <div key={field.id}>
            {label}
            <FieldInput
              field={field}
              value={value}
              disabled={disabled}
              onChange={(v) => setValue(field.id, v)}
              onUpload={uploadCareerFile}
            />
            {help}
          </div>
        );
      })}
    </div>
  );
}

function FieldInput({
  field,
  value,
  disabled,
  onChange,
  onUpload,
}: {
  field: CustomField;
  value: CustomResponses[string] | undefined;
  disabled?: boolean;
  onChange: (v: CustomResponses[string]) => void;
  onUpload: (file: File) => Promise<string>;
}) {
  const inputClass =
    "mt-2 w-full rounded-[3px] border border-sand bg-input-bg px-3 py-2 font-body text-sm text-choc outline-none focus:border-lightbr";

  const type = field.type as FieldType;

  if (type === "textarea") {
    return (
      <textarea
        className={inputClass}
        rows={4}
        disabled={disabled}
        placeholder={field.placeholder}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (type === "dropdown") {
    return (
      <select
        className={inputClass}
        disabled={disabled}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="mt-2 space-y-2">
        {(field.options ?? []).map((opt) => (
          <label key={opt} className="flex items-center gap-2 font-body text-sm text-choc">
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(opt)}
              onChange={(e) => {
                if (e.target.checked) onChange([...selected, opt]);
                else onChange(selected.filter((s) => s !== opt));
              }}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (type === "yes_no") {
    return (
      <div className="mt-2 flex gap-4">
        {(["Yes", "No"] as const).map((opt) => (
          <label key={opt} className="flex items-center gap-2 font-body text-sm text-choc">
            <input
              type="radio"
              name={field.id}
              disabled={disabled}
              checked={value === (opt === "Yes")}
              onChange={() => onChange(opt === "Yes")}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (type === "rating_scale") {
    const min = field.minValue ?? 1;
    const max = field.maxValue ?? 5;
    const num = typeof value === "number" ? value : 0;
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-full border font-body text-sm ${
              num === n ? "border-lightbr bg-lightbr text-cream" : "border-sand text-choc"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  if (type === "file_upload") {
    return (
      <div className="mt-2">
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          disabled={disabled}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const url = await onUpload(f);
            onChange(url);
            e.target.value = "";
          }}
          className="font-body text-sm text-choc"
        />
        {typeof value === "string" && value ? (
          <p className="mt-1 font-body text-xs text-text-light">Uploaded ✓</p>
        ) : null}
      </div>
    );
  }

  const htmlType =
    type === "number"
      ? "number"
      : type === "phone"
        ? "tel"
        : type === "url"
          ? "url"
          : type === "date"
            ? "date"
            : "text";

  return (
    <input
      type={htmlType}
      className={inputClass}
      disabled={disabled}
      placeholder={field.placeholder}
      value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
      onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
    />
  );
}
