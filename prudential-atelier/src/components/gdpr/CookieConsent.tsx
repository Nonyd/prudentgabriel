"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  acceptAllConsent,
  CURRENT_CONSENT_VERSION,
  readCookieConsent,
  rejectNonEssentialConsent,
  saveCookieConsent,
  type CookieConsent,
} from "@/lib/cookie-consent";
import { Toggle } from "@/components/ui/Toggle";
import { useCookieConsentStore } from "@/store/cookieConsentStore";

export function CookieConsent() {
  const isModalOpen = useCookieConsentStore((s) => s.isModalOpen);
  const openModal = useCookieConsentStore((s) => s.openModal);
  const closeModal = useCookieConsentStore((s) => s.closeModal);

  const [showBanner, setShowBanner] = useState(false);
  const [prefs, setPrefs] = useState<Omit<CookieConsent, "timestamp">>({
    version: CURRENT_CONSENT_VERSION,
    necessary: true,
    functional: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const existing = readCookieConsent();
    if (!existing || existing.version !== CURRENT_CONSENT_VERSION) {
      setShowBanner(true);
      if (existing) {
        setPrefs({
          version: CURRENT_CONSENT_VERSION,
          necessary: true,
          functional: existing.functional,
          analytics: existing.analytics,
          marketing: existing.marketing,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      const existing = readCookieConsent();
      if (existing) {
        setPrefs({
          version: CURRENT_CONSENT_VERSION,
          necessary: true,
          functional: existing.functional,
          analytics: existing.analytics,
          marketing: existing.marketing,
        });
      }
    }
  }, [isModalOpen]);

  const dismiss = () => {
    setShowBanner(false);
    closeModal();
  };

  const handleAcceptAll = () => {
    acceptAllConsent();
    dismiss();
  };

  const handleReject = () => {
    rejectNonEssentialConsent();
    dismiss();
  };

  const handleSavePrefs = () => {
    saveCookieConsent(prefs);
    dismiss();
  };

  if (!showBanner && !isModalOpen) return null;

  return (
    <>
      {showBanner && !isModalOpen ? (
        <div
          className="fixed inset-x-3 bottom-3 z-[100] glass-1 glass-panel px-4 py-4 sm:px-6"
        >
          <div className="mx-auto flex min-w-0 max-w-site flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p
              className="max-w-2xl leading-relaxed"
              style={{ fontFamily: "var(--font-lora)", fontSize: "13px", color: "var(--text-primary)" }}
            >
              <span aria-hidden className="mr-1.5">
                🍪
              </span>
              We use cookies to enhance your experience.{" "}
              <Link href="/cookie-policy" className="underline hover:text-choc">
                Read our Cookie Policy
              </Link>{" "}
              to learn more.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openModal}
                className="rounded-sm border border-choc/30 px-4 py-2 font-sans text-[13px] font-normal text-choc transition-colors hover:border-choc"
              >
                Cookie Settings
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="rounded-sm border border-choc/30 px-4 py-2 font-sans text-[13px] font-normal text-choc transition-colors hover:border-choc"
              >
                Reject Non-Essential
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="rounded-sm bg-choc px-4 py-2 font-sans text-[13px] font-normal text-cream transition-opacity hover:opacity-90"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog.Root open={isModalOpen} onOpenChange={(open) => (open ? openModal() : closeModal())}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[110] bg-choc/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[120] w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 glass-3 glass-panel p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <Dialog.Title className="font-display text-xl text-choc">Cookie Preferences</Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className="text-text-light hover:text-choc" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>

            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-sans text-sm font-semibold text-choc">Strictly Necessary</p>
                  <p className="mt-1 font-sans text-xs text-text-mid">Required for the site to work.</p>
                </div>
                <span className="shrink-0 font-sans text-[10px] font-semibold uppercase tracking-wider text-text-light">
                  Always On
                </span>
              </div>

              {(
                [
                  ["functional", "Functional Cookies", "Remember your preferences."],
                  ["analytics", "Analytics Cookies", "Help us improve the site."],
                  ["marketing", "Marketing Cookies", "Personalised content."],
                ] as const
              ).map(([key, title, desc]) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-sans text-sm font-semibold text-choc">{title}</p>
                    <p className="mt-1 font-sans text-xs text-text-mid">{desc}</p>
                  </div>
                  <Toggle
                    checked={prefs[key]}
                    onChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
                    srLabel={title}
                    checkedClassName="bg-lightbr"
                    uncheckedClassName="bg-cream/30"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSavePrefs}
              className="mt-6 w-full rounded-sm bg-choc py-3 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-cream transition-opacity hover:opacity-90"
            >
              Save Preferences
            </button>

            <p className="mt-4 text-center font-sans text-[11px] text-text-light">
              <Link href="/privacy-policy" className="hover:text-choc hover:underline">
                Privacy Policy
              </Link>
              {" | "}
              <Link href="/cookie-policy" className="hover:text-choc hover:underline">
                Cookie Policy
              </Link>
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
