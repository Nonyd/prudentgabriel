"use client";

import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export type BulkColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
};

interface BulkSelectTableProps<T extends { id: string }> {
  columns: BulkColumn<T>[];
  data: T[];
  onBulkDelete: (ids: string[]) => Promise<void> | void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function BulkSelectTable<T extends { id: string }>({
  columns,
  data,
  onBulkDelete,
  onRowClick,
  emptyMessage = "No records found.",
}: BulkSelectTableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const allSelected = data.length > 0 && selected.size === data.length;
  const ids = useMemo(() => Array.from(selected), [selected]);

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(data.map((d) => d.id)));
  }, [allSelected, data]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const runDelete = async () => {
    setDeleting(true);
    try {
      await onBulkDelete(ids);
      setSelected(new Set());
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-sand bg-bg/50 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-text-light">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                  />
                </th>
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-4 py-12 text-center font-sans text-sm text-text-mid"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-sand/70 font-sans text-xs text-text-dark",
                      onRowClick && "cursor-pointer hover:bg-bg/40",
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={`Select row ${row.id}`}
                      />
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-lg border border-sand bg-ivory px-5 py-3 shadow-lg">
          <span className="font-sans text-xs text-text-mid">{selected.size} selected</span>
          <Button type="button" variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
            Delete Selected
          </Button>
          <button
            type="button"
            className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid"
            onClick={() => setSelected(new Set())}
          >
            Deselect All
          </button>
        </div>
      ) : null}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete selected items?"
        description={`This will permanently delete ${selected.size} record(s).`}
      >
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost-light" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" loading={deleting} onClick={() => void runDelete()}>
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
