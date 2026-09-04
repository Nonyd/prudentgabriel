import { AA0_LINES } from "@/lib/finance/aa0";

export function FinanceAa0Note() {
  return (
    <div className="border border-sand bg-ivory px-4 py-3 text-[13px] leading-6 text-[#4A4A47]">
      {AA0_LINES.map((line) => (
        <p key={line.title} className="mt-2 first:mt-0">
          <span className="font-medium text-choc">{line.title}. </span>
          {line.body}
        </p>
      ))}
    </div>
  );
}
