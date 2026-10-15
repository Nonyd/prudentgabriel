import {
  CONSULTATION_RECEIPT_INTRO,
  CONSULTATION_SIGN_OFF,
  consultationLetter,
  consultationPrepPoints,
} from "@/lib/consultation-prep-copy";

/**
 * The same letter the paid-consultation email carries, on the page the client
 * lands on after paying (online) or uploading a transfer receipt.
 */
export function ConsultationPrepNotes({
  isVirtual,
  durationMinutes,
  receiptOnly = false,
}: {
  isVirtual: boolean;
  durationMinutes: number;
  /** Bank transfer: the receipt is in but the payment is not confirmed yet. */
  receiptOnly?: boolean;
}) {
  const points = consultationPrepPoints({ isVirtual, durationMinutes });
  const letter = consultationLetter(isVirtual);
  const intro = receiptOnly ? CONSULTATION_RECEIPT_INTRO : letter.intro;

  return (
    <div className="mt-10 rounded-sm border border-border bg-cream px-6 py-8 text-left font-body text-[15px] leading-7 text-charcoal sm:px-8">
      {intro.map((line) => (
        <p key={line} className="mb-4">
          {line}
        </p>
      ))}
      <p className="mb-5">{letter.lead}</p>
      <ol className="space-y-5">
        {points.map((point, i) => (
          <li key={point.title}>
            <p className="font-display text-lg text-choc">
              {i + 1}. {point.title}
            </p>
            <p className="mt-1 text-charcoal-mid">{point.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 space-y-4">
        {letter.closing.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <p className="mt-6">
        {CONSULTATION_SIGN_OFF.line}
        <br />
        <span className="font-display text-lg text-choc">{CONSULTATION_SIGN_OFF.team}</span>
      </p>
    </div>
  );
}
