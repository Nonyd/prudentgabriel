import { FONT_UI, EMAIL_CHOC, EMAIL_CREAM } from "./email-tokens";

type EmailButtonProps = {
  href: string;
  children: string;
};

/** Bulletproof table button. Do not style a bare <a>. */
export default function EmailButton({ href, children }: EmailButtonProps) {
  return (
    <table border={0} cellPadding={0} cellSpacing={0} role="presentation" style={{ margin: "24px 0 8px" }}>
      <tbody>
        <tr>
          <td align="center" {...({ bgcolor: EMAIL_CHOC } as Record<string, string>)} style={{ backgroundColor: EMAIL_CHOC }}>
            <a
              href={href}
              style={{
                display: "inline-block",
                padding: "14px 28px",
                backgroundColor: EMAIL_CHOC,
                color: EMAIL_CREAM,
                fontFamily: FONT_UI,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                textDecoration: "none",
                lineHeight: "16px",
              }}
            >
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
