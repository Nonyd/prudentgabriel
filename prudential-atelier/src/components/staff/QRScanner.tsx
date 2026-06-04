"use client";

import { useEffect, useId, useRef, useState } from "react";

type QRScannerProps = {
  onScan: (code: string) => void;
  active?: boolean;
};

export function QRScanner({ onScan, active = true }: QRScannerProps) {
  const elementId = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const lastScanRef = useRef("");
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!active) return;

    let mounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (!mounted) return;
            const code = decoded.trim();
            if (!code || code === lastScanRef.current) return;
            lastScanRef.current = code;
            onScanRef.current(code);
          },
          () => {},
        );

        if (mounted) setError(null);
      } catch {
        if (mounted) setError("Camera not available — enter code manually");
      }
    };

    void startScanner();

    return () => {
      mounted = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        void scanner
          .stop()
          .then(() => {
            scanner.clear();
          })
          .catch(() => {});
      }
    };
  }, [active, elementId]);

  return (
    <div className="space-y-2">
      <div
        id={elementId}
        className="min-h-[220px] overflow-hidden rounded-md border border-sand bg-black/5 [&_video]:rounded-md"
      />
      {error ? (
        <p className="font-sans text-xs text-red-600">{error}</p>
      ) : (
        <p className="font-sans text-xs text-text-light">Point your camera at the workstation QR code</p>
      )}
    </div>
  );
}
