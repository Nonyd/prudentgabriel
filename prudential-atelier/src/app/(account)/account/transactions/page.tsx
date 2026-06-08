import Link from "next/link";
import { auth } from "@/auth";
import {
  formatGateway,
  formatTransactionStatus,
  getClientTransactions,
} from "@/lib/client-transactions";
import { formatPrice } from "@/lib/utils";

function formatWhen(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

export default async function AccountTransactionsPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const email = session!.user!.email!;

  const transactions = await getClientTransactions(userId, email);

  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <h1 className="font-display text-4xl text-choc">Transactions</h1>
        <p className="mt-2 font-sans text-sm text-text-mid">
          {transactions.length === 0
            ? "No payment activity yet"
            : `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="mt-10">
        {transactions.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <p className="font-sans text-sm text-text-mid">
              When you pay for consultations, commissions, or ready-to-wear orders, they will appear
              here.
            </p>
            <Link href="/shop" className="btn-primary mt-6 inline-flex">
              Browse the collection
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-sm border border-sand bg-ivory dark:border-sand/30 dark:bg-bg-card">
            <div className="hidden border-b border-sand px-5 py-3 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light sm:grid sm:grid-cols-[1.4fr_1fr_0.8fr_0.7fr] dark:border-sand/30">
              <span>Description</span>
              <span>Date</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Status</span>
            </div>
            <ul className="divide-y divide-sand dark:divide-sand/30">
              {transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="px-5 py-4 sm:grid sm:grid-cols-[1.4fr_1fr_0.8fr_0.7fr] sm:items-center sm:gap-4"
                >
                  <div>
                    <p className="font-sans text-sm font-medium text-choc dark:text-cream">
                      {tx.href ? (
                        <Link href={tx.href} className="hover:text-lightbr hover:underline">
                          {tx.label}
                        </Link>
                      ) : (
                        tx.label
                      )}
                    </p>
                    {tx.detail ? (
                      <p className="mt-0.5 font-sans text-xs text-text-mid">{tx.detail}</p>
                    ) : null}
                    <p className="mt-1 font-sans text-[10px] uppercase tracking-wider text-text-light sm:hidden">
                      {formatWhen(tx.date)} · {formatGateway(tx.gateway)}
                      {tx.reference ? ` · ${tx.reference.slice(0, 12)}…` : ""}
                    </p>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <p className="font-sans text-xs text-text-mid">{formatWhen(tx.date)}</p>
                    <p className="mt-0.5 hidden font-sans text-[10px] text-text-light sm:block">
                      {formatGateway(tx.gateway)}
                      {tx.reference ? (
                        <span className="block truncate" title={tx.reference}>
                          Ref: {tx.reference}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <p className="mt-2 text-left font-sans text-sm font-medium text-choc dark:text-cream sm:mt-0 sm:text-right">
                    {formatPrice(tx.amount, tx.currency as "NGN" | "USD" | "GBP")}
                  </p>
                  <p className="mt-1 text-left font-sans text-[10px] uppercase tracking-wider text-text-mid sm:mt-0 sm:text-right">
                    {formatTransactionStatus(tx.status)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
