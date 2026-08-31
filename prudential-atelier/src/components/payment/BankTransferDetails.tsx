import type { PublicBankAccount } from "@/lib/payments/bank-account";
import { feeBearerLabel, feeToleranceLabel } from "@/lib/payments/bank-account";

type Props = {
  bank: PublicBankAccount;
  paymentReference?: string | null;
  className?: string;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-1">
      <span className="text-text-light">{label}:</span> {value}
    </p>
  );
}

/** Renders only populated international fields and the payment reference. */
export function BankTransferDetails({ bank, paymentReference, className }: Props) {
  const bearer = feeBearerLabel(bank.feeBearer);
  const tolerance = feeToleranceLabel(bank.currency, bank.feeTolerance);
  return (
    <div className={className ?? "font-body text-sm text-text-mid"}>
      <Row label="Bank" value={bank.bankName} />
      <Row label="Account" value={bank.accountNumber} />
      <Row label="Name" value={bank.accountName} />
      {bank.iban ? <Row label="IBAN" value={bank.iban} /> : null}
      {bank.swiftBic ? <Row label="SWIFT / BIC" value={bank.swiftBic} /> : null}
      {bank.sortCode ? <Row label="Sort code" value={bank.sortCode} /> : null}
      {bank.routingNumber ? <Row label="Routing number" value={bank.routingNumber} /> : null}
      {bank.intermediaryBank ? (
        <p className="mt-2 whitespace-pre-wrap">
          <span className="text-text-light">Intermediary bank:</span> {bank.intermediaryBank}
        </p>
      ) : null}
      {bank.instructions ? (
        <p className="mt-2 whitespace-pre-wrap text-text-mid">{bank.instructions}</p>
      ) : null}
      {bearer ? <p className="mt-3 text-xs leading-relaxed text-text-light">{bearer}</p> : null}
      {tolerance ? <p className="mt-2 text-xs leading-relaxed text-text-light">{tolerance}</p> : null}
      {paymentReference ? (
        <p className="mt-3 rounded-sm border border-choc/20 bg-cream px-3 py-2 font-sans text-sm text-choc">
          Payment reference: <span className="font-medium tracking-wide">{paymentReference}</span>
          <span className="mt-1 block font-body text-xs font-normal text-text-light">
            Put this in your transfer narration so we can match your payment. International transfers
            often arrive with little usable narration — this reference is how we find you.
          </span>
        </p>
      ) : null}
    </div>
  );
}
