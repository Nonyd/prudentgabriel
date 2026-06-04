"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function AttendanceQrDisplay({ payload }: { payload: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!payload || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, payload, {
      width: 400,
      margin: 2,
      color: { dark: "#2C1810", light: "#FAF7F2" },
    });
  }, [payload]);

  if (!payload) {
    return (
      <div className="flex h-[400px] w-[400px] max-w-full items-center justify-center rounded-lg bg-cream/10">
        <p className="font-sans text-sm text-cream/70">No active QR code — contact HR</p>
      </div>
    );
  }

  return <canvas ref={canvasRef} className="max-w-full rounded-lg" aria-label="Attendance QR code" />;
}
