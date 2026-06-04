import { useCallback, useState } from "react";

export function useBulkSelect(initial: string[] = []) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  return {
    selected,
    selectedIds: Array.from(selected),
    toggle,
    toggleAll,
    clear,
    count: selected.size,
  };
}
