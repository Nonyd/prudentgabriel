"use client";

import { useState } from "react";
import { CONTACT_SUBJECTS } from "@/validations/contact";

type FieldErrors = Partial<Record<"name" | "email" | "phone" | "subject" | "message", string>>;

export function ContactForm({ autoReplyHint }: { autoReplyHint?: string }) {
  const [sent, setSent] = useState(false);
  const [sentName, setSentName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setFormError("");

    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? "") || undefined,
      subject: String(fd.get("subject") ?? ""),
      message: String(fd.get("message") ?? ""),
    };

    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: { fieldErrors?: FieldErrors; formErrors?: string[] };
      };

      if (!res.ok) {
        if (data.error?.fieldErrors) {
          setErrors(data.error.fieldErrors);
        } else {
          setFormError("Could not send your message. Please try again.");
        }
        return;
      }

      setSentName(body.name);
      setSent(true);
    } catch {
      setFormError("Could not send your message. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const labelStyle = {
    fontFamily: "var(--font-ui)",
    fontSize: "10px",
    fontWeight: 600 as const,
    letterSpacing: "0.16em",
    color: "var(--lightbr)",
    textTransform: "uppercase" as const,
  };

  const inputStyle = {
    fontFamily: "var(--font-body)",
    fontSize: "14px",
    color: "var(--text-mid)",
    borderBottom: "0.5px solid var(--sand)",
  };

  const errorStyle = {
    fontFamily: "var(--font-ui)",
    fontSize: "11px",
    color: "var(--error)",
  };

  if (sent) {
    return (
      <div className="py-12 text-center">
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "28px",
            color: "var(--choc)",
          }}
        >
          ✓ Message sent
        </p>
        <p
          className="mx-auto mt-4 max-w-md"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "15px",
            color: "var(--text-mid)",
            lineHeight: 1.7,
          }}
        >
          Thank you, {sentName}. {autoReplyHint ?? "We'll be in touch within 24 hours."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.18em",
          color: "var(--choc)",
        }}
      >
        SEND US A MESSAGE
      </h2>
      <div className="mt-2 h-px w-full bg-sand" />

      <form onSubmit={onSubmit} className="mt-8 space-y-6" noValidate>
        <div>
          <label htmlFor="contact-name" style={labelStyle}>
            Full Name
          </label>
          <input
            id="contact-name"
            name="name"
            required
            className="mt-2 w-full bg-transparent py-2 outline-none"
            style={inputStyle}
          />
          {errors.name ? (
            <p className="mt-1" style={errorStyle}>
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="contact-email" style={labelStyle}>
            Email Address
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            className="mt-2 w-full bg-transparent py-2 outline-none"
            style={inputStyle}
          />
          {errors.email ? (
            <p className="mt-1" style={errorStyle}>
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="contact-phone" style={labelStyle}>
            Phone Number <span className="normal-case tracking-normal opacity-70">(optional)</span>
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            className="mt-2 w-full bg-transparent py-2 outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="contact-subject" style={labelStyle}>
            Subject
          </label>
          <select
            id="contact-subject"
            name="subject"
            required
            defaultValue=""
            className="mt-2 w-full bg-transparent py-2 outline-none"
            style={inputStyle}
          >
            <option value="" disabled>
              Select a subject
            </option>
            {CONTACT_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.subject ? (
            <p className="mt-1" style={errorStyle}>
              {errors.subject}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="contact-message" style={labelStyle}>
            Message
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={20}
            rows={5}
            placeholder="Tell us how we can help (min. 20 characters)"
            className="mt-2 w-full resize-y rounded-[3px] border border-sand bg-input-bg p-3 outline-none focus:border-choc"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--text-mid)",
            }}
          />
          {errors.message ? (
            <p className="mt-1" style={errorStyle}>
              {errors.message}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p style={errorStyle}>{formError}</p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-[3px] transition-opacity disabled:opacity-50"
          style={{
            height: "52px",
            backgroundColor: "var(--choc)",
            color: "var(--cream)",
            fontFamily: "var(--font-ui)",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {busy ? "Sending…" : "Send Message →"}
        </button>
      </form>
    </div>
  );
}
