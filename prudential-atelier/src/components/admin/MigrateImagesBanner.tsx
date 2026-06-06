"use client";

import { useState } from "react";
import toast from "react-hot-toast";

type MigrateImagesBannerProps = {
  initialCount: number;
};

export function MigrateImagesBanner({ initialCount }: MigrateImagesBannerProps) {
  const [count, setCount] = useState(initialCount);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ migrated: number; failed: number } | null>(null);

  if (count < 1 && !result) return null;

  const migrate = async () => {
    setRunning(true);
    setResult(null);
    setProgress({ done: 0, total: count });

    try {
      const res = await fetch("/api/admin/products/migrate-images", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as {
        total?: number;
        migrated?: number;
        failed?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Migration failed");
      }

      const total = data.total ?? count;
      const migrated = data.migrated ?? 0;
      const failed = data.failed ?? 0;

      setProgress({ done: total, total });
      setResult({ migrated, failed });
      setCount(failed);

      if (failed === 0) {
        toast.success(`${migrated} image${migrated === 1 ? "" : "s"} migrated to Cloudinary`);
      } else {
        toast.error(`${failed} image${failed === 1 ? "" : "s"} could not be migrated`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Migration failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mb-6 rounded-sm border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
      {result ? (
        <p>
          {result.failed === 0 ? (
            <>✓ {result.migrated} image{result.migrated === 1 ? "" : "s"} migrated successfully</>
          ) : (
            <>
              ✓ {result.migrated} image{result.migrated === 1 ? "" : "s"} migrated successfully
              <br />⚠ {result.failed} image{result.failed === 1 ? "" : "s"} failed (original URLs unreachable)
            </>
          )}
        </p>
      ) : (
        <>
          <p>
            ⚠ {count} product image{count === 1 ? "" : "s"} still hosted on the old WordPress server. These may
            appear broken for visitors.
          </p>
          {running && progress ? (
            <p className="mt-2 text-xs text-amber-200/80">
              Migrating images… {progress.done} / {progress.total} complete
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void migrate()}
              disabled={running}
              className="mt-2 rounded-sm border border-amber-600/50 px-3 py-1.5 text-xs uppercase tracking-wide text-amber-50 hover:bg-amber-900/40 disabled:opacity-50"
            >
              Migrate all images to Cloudinary →
            </button>
          )}
        </>
      )}
    </div>
  );
}
