"use client";



import { useCallback, useEffect, useRef, useState } from "react";

import { format } from "date-fns";

import toast from "react-hot-toast";

import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";

import { Modal } from "@/components/ui/Modal";

import { QRScanner } from "@/components/staff/QRScanner";



type ClockStatus = {

  isClockedIn: boolean;

  log: { clockIn: string | null; clockOut: string | null; totalHours: number | null } | null;

  employmentType: string;

};



type AssignmentOption = { orderId: string; label: string };



type HistoryRow = {

  date: string;

  clockIn: string | null;

  clockOut: string | null;

  totalHours: number | null;

  taskNote: string | null;

};



export default function StaffTimePage() {

  const [status, setStatus] = useState<ClockStatus | null>(null);

  const [history, setHistory] = useState<HistoryRow[]>([]);

  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);

  const [manualCode, setManualCode] = useState("");

  const [taskNote, setTaskNote] = useState("");

  const [selectedOrder, setSelectedOrder] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);

  const [pendingCode, setPendingCode] = useState("");

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);

  const [clockInSuccessAt, setClockInSuccessAt] = useState<Date | null>(null);

  const scanLockRef = useRef(false);



  const refresh = useCallback(async () => {

    const [statusRes, historyRes, tasksRes] = await Promise.all([

      fetch("/api/staff/clock-status"),

      fetch("/api/staff/attendance-history"),

      fetch("/api/staff/tasks?filter=active"),

    ]);

    if (statusRes.ok) setStatus((await statusRes.json()) as ClockStatus);

    if (historyRes.ok) {

      const d = (await historyRes.json()) as { items: HistoryRow[] };

      setHistory(d.items);

    }

    if (tasksRes.ok) {

      const d = (await tasksRes.json()) as {

        items: { orderId: string; orderRef: string; outfitDescription: string | null }[];

      };

      setAssignments(

        d.items.map((i) => ({

          orderId: i.orderId,

          label: `${i.orderRef} — ${i.outfitDescription ?? "Order"}`,

        })),

      );

    }

    setLoading(false);

  }, []);



  useEffect(() => {

    void refresh();

  }, [refresh]);



  const submitClockIn = useCallback(

    async (code: string, note: string, fromQr = false) => {

      if (actionLoading || scanLockRef.current) return;

      scanLockRef.current = true;

      setActionLoading(true);

      try {

        const res = await fetch("/api/attendance/clock-in", {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({ qrCode: code, taskNote: note }),

        });

        const data = (await res.json()) as { message?: string; error?: string; clockIn?: string };

        if (!res.ok) {

          toast.error(data.error ?? "Clock-in failed");

          scanLockRef.current = false;

          return;

        }

        setClockInSuccessAt(new Date(data.clockIn ?? Date.now()));

        setConfirmOpen(false);

        setManualCode("");

        await refresh();

        if (!fromQr) {

          toast.success(data.message ?? "Clocked in");

        }

      } finally {

        setActionLoading(false);

        setTimeout(() => {

          scanLockRef.current = false;

        }, 2000);

      }

    },

    [actionLoading, refresh],

  );



  const onQrScan = useCallback(

    (code: string) => {

      void submitClockIn(code, taskNote, true);

    },

    [submitClockIn, taskNote],

  );



  const onManualSubmit = () => {

    const code = manualCode.trim();

    if (!code) {

      toast.error("Enter the QR code from the workstation display");

      return;

    }

    setPendingCode(code);

    setConfirmOpen(true);

  };



  const clockOut = async () => {

    setActionLoading(true);

    try {

      const res = await fetch("/api/attendance/clock-out", { method: "POST" });

      const data = (await res.json()) as { message?: string; error?: string };

      if (!res.ok) {

        toast.error(data.error ?? "Clock-out failed");

        return;

      }

      setClockInSuccessAt(null);

      toast.success(data.message ?? "Clocked out");

      void refresh();

    } finally {

      setActionLoading(false);

    }

  };



  if (loading) {

    return <Loader2 className="mx-auto h-6 w-6 animate-spin text-choc" />;

  }



  const hoursToday = status?.log?.totalHours;

  const successTime = clockInSuccessAt ?? (status?.log?.clockIn ? new Date(status.log.clockIn) : null);



  return (

    <div className="space-y-6">

      <h1 className="font-display text-2xl text-ink">Time & attendance</h1>



      {status?.employmentType === "FREELANCER" ? (

        <p className="rounded-lg border border-sand bg-white p-4 font-sans text-sm text-text-mid">

          Freelancers are not required to clock in.

        </p>

      ) : status?.isClockedIn ? (

        <div className="rounded-lg border border-sand bg-white p-4">

          <div className="flex items-start gap-3">

            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden />

            <div>

              <p className="font-sans text-sm font-medium text-ink">

                Clocked in at {successTime ? format(successTime, "h:mm a") : "—"}

              </p>

              {hoursToday != null ? (

                <p className="mt-1 font-sans text-xs text-text-mid">

                  You worked {hoursToday.toFixed(2)}h today

                </p>

              ) : null}

            </div>

          </div>

          <Button className="mt-4" onClick={() => void clockOut()} disabled={actionLoading}>

            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Clock out"}

          </Button>

        </div>

      ) : (

        <div className="space-y-4 rounded-lg border border-sand bg-white p-4">

          {clockInSuccessAt ? (

            <div

              className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 p-4"

              role="status"

            >

              <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" aria-hidden />

              <p className="font-sans text-sm font-medium text-green-900">

                Clocked in at {format(clockInSuccessAt, "h:mm a")}

              </p>

            </div>

          ) : null}



          <QRScanner onScan={onQrScan} active={!actionLoading && !status?.isClockedIn} />



          {actionLoading ? (

            <div className="flex items-center justify-center gap-2 py-2 font-sans text-sm text-text-mid">

              <Loader2 className="h-4 w-4 animate-spin" />

              Recording clock-in…

            </div>

          ) : null}



          <div className="border-t border-sand pt-4">

            <p className="mb-2 font-sans text-xs text-text-mid">Or enter the code manually</p>

            <input

              value={manualCode}

              onChange={(e) => setManualCode(e.target.value)}

              placeholder="Enter QR code manually"

              className="w-full rounded-[3px] border border-sand px-3 py-2.5 font-sans text-sm"

            />

            <Button className="mt-3 w-full" onClick={onManualSubmit} disabled={actionLoading}>

              Continue

            </Button>

          </div>

        </div>

      )}



      <section>

        <h2 className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">

          Last 30 days

        </h2>

        <div className="overflow-x-auto rounded-lg border border-sand bg-white">

          <table className="w-full min-w-[320px] text-left font-sans text-xs">

            <thead>

              <tr className="border-b border-sand text-text-light">

                <th className="px-3 py-2">Date</th>

                <th className="px-3 py-2">In</th>

                <th className="px-3 py-2">Out</th>

                <th className="px-3 py-2">Hours</th>

              </tr>

            </thead>

            <tbody>

              {history.map((row) => (

                <tr key={row.date} className="border-b border-sand/60">

                  <td className="px-3 py-2">{format(new Date(row.date), "d MMM")}</td>

                  <td className="px-3 py-2">

                    {row.clockIn ? format(new Date(row.clockIn), "HH:mm") : "—"}

                  </td>

                  <td className="px-3 py-2">

                    {row.clockOut ? format(new Date(row.clockOut), "HH:mm") : "—"}

                  </td>

                  <td className="px-3 py-2">{row.totalHours?.toFixed(1) ?? "—"}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </section>



      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm clock in">

        <div className="space-y-4">

          <p className="font-sans text-sm text-text-mid">What will you be working on today?</p>

          {assignments.length > 0 ? (

            <select

              value={selectedOrder}

              onChange={(e) => {

                setSelectedOrder(e.target.value);

                const opt = assignments.find((a) => a.orderId === e.target.value);

                if (opt) setTaskNote(opt.label);

              }}

              className="w-full rounded-[3px] border border-sand px-3 py-2 font-sans text-sm"

            >

              <option value="">Select assigned order</option>

              {assignments.map((a) => (

                <option key={a.orderId} value={a.orderId}>

                  {a.label}

                </option>

              ))}

            </select>

          ) : null}

          <input

            value={taskNote}

            onChange={(e) => setTaskNote(e.target.value)}

            placeholder="Describe your task"

            className="w-full rounded-[3px] border border-sand px-3 py-2 font-sans text-sm"

          />

          <Button

            className="w-full"

            disabled={actionLoading}

            onClick={() => void submitClockIn(pendingCode, taskNote)}

          >

            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm clock in"}

          </Button>

        </div>

      </Modal>

    </div>

  );

}


