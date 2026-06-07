"use client";

import { X } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import {
  newCustomField,
  type CustomField,
  type FieldType,
} from "@/lib/job-custom-fields";

const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: "text", label: "Text Input" },
  { type: "textarea", label: "Long Text (Textarea)" },
  { type: "dropdown", label: "Dropdown (single select)" },
  { type: "multi_select", label: "Multi-select checkboxes" },
  { type: "file_upload", label: "File Upload (PDF/Image)" },
  { type: "yes_no", label: "Yes / No" },
  { type: "date", label: "Date Picker" },
  { type: "number", label: "Number" },
  { type: "phone", label: "Phone Number" },
  { type: "url", label: "URL / Website" },
  { type: "rating_scale", label: "Rating Scale (1–5)" },
  { type: "section_heading", label: "Section Heading" },
];

export function CustomFieldBuilder({
  fields,
  onChange,
}: {
  fields: CustomField[];
  onChange: (next: CustomField[]) => void;
}) {
  function updateField(id: string, patch: Partial<CustomField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    onChange(fields.filter((f) => f.id !== id).map((f, i) => ({ ...f, order: i })));
  }

  function moveField(id: string, dir: -1 | 1) {
    const idx = fields.findIndex((f) => f.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= fields.length) return;
    const copy = [...fields];
    [copy[idx], copy[next]] = [copy[next]!, copy[idx]!];
    onChange(copy.map((f, i) => ({ ...f, order: i })));
  }

  function addField(type: FieldType) {
    onChange([...fields, newCustomField(type, fields.length)]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-sm border border-sand px-3 py-2 font-body text-xs"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value as FieldType;
            if (v) addField(v);
            e.target.value = "";
          }}
        >
          <option value="">+ Add Field</option>
          {FIELD_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="rounded-sm border border-sand bg-[#FAFAFA] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" className="font-body text-xs text-charcoal-mid" onClick={() => moveField(field.id, -1)}>
                ↑
              </button>
              <button type="button" className="font-body text-xs text-charcoal-mid" onClick={() => moveField(field.id, 1)}>
                ↓
              </button>
              <span className="font-label text-[10px] uppercase tracking-wide text-[#A8A8A4]">
                {FIELD_TYPES.find((t) => t.type === field.type)?.label ?? field.type}
              </span>
            </div>
            <button type="button" onClick={() => removeField(field.id)} aria-label="Remove field">
              <X size={16} />
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <input
              value={field.label}
              onChange={(e) => updateField(field.id, { label: e.target.value })}
              placeholder="Label"
              className="w-full rounded-sm border border-sand px-2 py-1.5 font-body text-sm"
            />
            {field.type !== "section_heading" ? (
              <>
                <input
                  value={field.placeholder ?? ""}
                  onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                  placeholder="Placeholder"
                  className="w-full rounded-sm border border-sand px-2 py-1.5 font-body text-sm"
                />
                <input
                  value={field.helpText ?? ""}
                  onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                  placeholder="Help text"
                  className="w-full rounded-sm border border-sand px-2 py-1.5 font-body text-sm"
                />
                <div className="flex items-center justify-between">
                  <span className="font-body text-xs text-charcoal">Required</span>
                  <Toggle
                    checked={field.required}
                    srLabel="Required"
                    onChange={(v) => updateField(field.id, { required: v })}
                  />
                </div>
              </>
            ) : null}

            {field.type === "dropdown" || field.type === "multi_select" ? (
              <div className="space-y-2">
                {(field.options ?? []).map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={opt}
                      onChange={(e) => {
                        const options = [...(field.options ?? [])];
                        options[i] = e.target.value;
                        updateField(field.id, { options });
                      }}
                      className="flex-1 rounded-sm border border-sand px-2 py-1 font-body text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateField(field.id, {
                          options: (field.options ?? []).filter((_, j) => j !== i),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="font-body text-xs text-olive"
                  onClick={() => updateField(field.id, { options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] })}
                >
                  + Add option
                </button>
              </div>
            ) : null}

            {field.type === "rating_scale" ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={field.minValue ?? 1}
                  onChange={(e) => updateField(field.id, { minValue: Number(e.target.value) })}
                  className="rounded-sm border border-sand px-2 py-1 font-body text-xs"
                  placeholder="Min"
                />
                <input
                  type="number"
                  value={field.maxValue ?? 5}
                  onChange={(e) => updateField(field.id, { maxValue: Number(e.target.value) })}
                  className="rounded-sm border border-sand px-2 py-1 font-body text-xs"
                  placeholder="Max"
                />
              </div>
            ) : null}
          </div>
          {index < fields.length - 1 ? null : null}
        </div>
      ))}
    </div>
  );
}
