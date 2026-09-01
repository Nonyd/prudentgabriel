/** Monochrome card and wallet marks. Mastercard is the circles; the rest are wordmarks. */

type MarkProps = { className?: string };

function Card({
  title,
  className,
  width,
  children,
}: {
  title: string;
  className?: string;
  width: number;
  children: React.ReactNode;
}) {
  return (
    <svg
      role="img"
      aria-label={title}
      width={width}
      height={24}
      viewBox={`0 0 ${width} 24`}
      className={className}
      fill="none"
    >
      <title>{title}</title>
      <rect
        x="0.5"
        y="0.5"
        width={width - 1}
        height="23"
        rx="2.5"
        stroke="currentColor"
        strokeOpacity="0.38"
      />
      {children}
    </svg>
  );
}

export function VisaMark({ className }: MarkProps) {
  return (
    <Card title="Visa" className={className} width={42}>
      <text
        x="21"
        y="16.2"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="11"
        fontStyle="italic"
        fontWeight="700"
        letterSpacing="0.6"
      >
        VISA
      </text>
    </Card>
  );
}

export function MastercardMark({ className }: MarkProps) {
  return (
    <Card title="Mastercard" className={className} width={42}>
      <circle cx="17" cy="12" r="5.4" fill="currentColor" fillOpacity="0.88" />
      <circle cx="25" cy="12" r="5.4" fill="currentColor" fillOpacity="0.42" />
    </Card>
  );
}

export function PaypalMark({ className }: MarkProps) {
  return (
    <Card title="PayPal" className={className} width={52}>
      <g fill="currentColor" transform="translate(10.5, 4.2) scale(0.64)">
        <path
          fillOpacity="0.42"
          d="M8.4 0H16c2.5 0 4.2.7 5.2 2.1.9 1.2 1 2.8.6 4.7-.8 3.5-3.4 5.2-6.8 5.2H11.6L10.2 20H6.4L8.4 0z"
        />
        <path d="M2.2 0h7.4c2.4 0 4.1.7 5.1 2.1.9 1.2.9 2.8.5 4.7C14.4 10.3 11.8 12 8.4 12H5.4L4 20H.2L2.2 0zm1.9 3.4L3.3 8.6h2.1c1.9 0 3.3-.7 3.8-2.6.4-1.6-.2-2.6-2.1-2.6H4.1z" />
      </g>
    </Card>
  );
}

export function VerveMark({ className }: MarkProps) {
  return (
    <Card title="Verve" className={className} width={48}>
      <text
        x="24"
        y="16"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="var(--font-jost), Jost, Helvetica, sans-serif"
        fontSize="8.5"
        fontWeight="600"
        letterSpacing="1.6"
      >
        VERVE
      </text>
    </Card>
  );
}

const SETS = {
  ngn: ["visa", "mastercard", "verve"] as const,
  flutterwave: ["visa", "mastercard", "verve", "paypal"] as const,
  intl: ["visa", "mastercard", "paypal"] as const,
  all: ["visa", "mastercard", "verve", "paypal"] as const,
};

export function PaymentMarks({
  set = "all",
  className,
  markClassName,
}: {
  set?: keyof typeof SETS;
  className?: string;
  markClassName?: string;
}) {
  const keys = SETS[set];
  return (
    <div className={className} aria-label="Accepted cards and PayPal">
      {keys.map((key) => {
        if (key === "visa") return <VisaMark key={key} className={markClassName} />;
        if (key === "mastercard") return <MastercardMark key={key} className={markClassName} />;
        if (key === "paypal") return <PaypalMark key={key} className={markClassName} />;
        return <VerveMark key={key} className={markClassName} />;
      })}
    </div>
  );
}

export function GatewayPaymentMarks({
  gateway,
  className,
  markClassName,
}: {
  gateway: "PAYSTACK" | "FLUTTERWAVE" | "STRIPE" | "MONNIFY";
  className?: string;
  markClassName?: string;
}) {
  if (gateway === "STRIPE") {
    return <PaymentMarks set="intl" className={className} markClassName={markClassName} />;
  }
  if (gateway === "FLUTTERWAVE") {
    return <PaymentMarks set="flutterwave" className={className} markClassName={markClassName} />;
  }
  if (gateway === "MONNIFY") return null;
  return <PaymentMarks set="ngn" className={className} markClassName={markClassName} />;
}
