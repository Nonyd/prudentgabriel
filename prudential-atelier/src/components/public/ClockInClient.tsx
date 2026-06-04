"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type ClockStatus = {
  isClockedIn: boolean;
  log: {
    clockIn: string | null;
    clockOut: string | null;
  } | null;
  staff: {
    employmentType: string;
    user: { name: string | null; email: string };
  };
};

type ClockInClientProps = {
  qrCode: string | null;
  expiresAt: string | null;
  initialStatus: ClockStatus | null;
};

export function ClockInClient({ qrCode, expiresAt, initialStatus }: ClockInClientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState(initialStatus);
  const [taskNote, setTaskNote] = useState("");
  const [loading, setLoading] = useState<"in" | "out" | null>(null);

  useEffect(() => {
    if (!qrCode || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, qrCode, {
      width: Math.min(280, window.innerWidth - 48),
      margin: 2,
      color: { dark: "#2C1810", light: "#FAF7F2" },
    });
  }, [qrCode]);

  async function clockIn() {
    if (!qrCode) {
      toast.error("No active QR code available");
      return;
    }
    setLoading("in");
    try {
      const res = await fetch("/api/attendance/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode, taskNote }),
      });
      const data = (await res.json()) as { message?: string; error?: string; alreadyClockedIn?: boolean };
      if (!res.ok) {
        toast.error(data.error ?? "Clock-in failed");
        return;
      }
      toast.success(data.message ?? "Clocked in");
      setStatus((s) =>
        s
          ? {
              ...s,
              isClockedIn: true,
              log: { clockIn: new Date().toISOString(), clockOut: null },
            }
          : s,
      );
    } finally {
      setLoading(null);
    }
  }

  async function clockOut() {
    setLoading("out");
    try {
      const res = await fetch("/api/attendance/clock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Clock-out failed");
        return;
      }
      toast.success(data.message ?? "Clocked out");
      setStatus((s) =>
        s
          ? {
              ...s,
              isClockedIn: false,
              log: {
                clockIn: s.log?.clockIn ?? null,
                clockOut: new Date().toISOString(),
              },
            }
          : s,
      );
    } finally {
      setLoading(null);
    }
  }

  const name = status?.staff.user.name ?? status?.staff.user.email ?? "Staff";
  const isFreelancer = status?.staff.employmentType === "FREELANCER";

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-bg px-4 py-8">
      <div className="text-center">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">
          Prudent Gabriel
        </p>
        <h1 className="mt-2 font-serif text-3xl font-medium text-choc">Staff Clock-In</h1>
        <p className="mt-2 font-sans text-sm text-text-mid">Welcome, {name}</p>
      </div>

      <div className="mt-8 card-surface p-6 text-center">
        {status ? (
          <div className="mb-6">
            {isFreelancer ? (
              <Badge variant="gold">Freelancer — no clock-in required</Badge>
            ) : status.isClockedIn ? (
              <Badge variant="success">
                Clocked in
                {status.log?.clockIn
                  ? ` at ${new Date(status.log.clockIn).toLocaleTimeString("en-NG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : ""}
              </Badge>
            ) : (
              <Badge variant="grey">Not yet clocked in today</Badge>
            )}
          </div>
        ) : null}

        {qrCode ? (
          <>
            <p className="font-sans text-xs text-text-mid">Scan or tap to clock in</p>
            <canvas ref={canvasRef} className="mx-auto mt-4 rounded-lg border border-sand" />
            {expiresAt ? (
              <p className="mt-3 font-sans text-[10px] text-text-light">
                Valid until {new Date(expiresAt).toLocaleString("en-NG")}
              </p>
            ) : null}
          </>
        ) : (
          <p className="font-sans text-sm text-text-mid">
            No active QR code. Contact HR or try again later.
          </p>
        )}

        {!isFreelancer ? (
          <div className="mt-6 space-y-3">
            <label className="block text-left">
              <span className="mb-1 block font-sans text-xs text-text-mid">
                Task note (optional)
              </span>
              <input
                type="text"
                value={taskNote}
                onChange={(e) => setTaskNote(e.target.value)}
                placeholder="What are you working on today?"
                className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                loading={loading === "in"}
                disabled={!qrCode || status?.isClockedIn}
                onClick={() => void clockIn()}
              >
                Clock In
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                loading={loading === "out"}
                disabled={!status?.isClockedIn}
                onClick={() => void clockOut()}
              >
                Clock Out
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
