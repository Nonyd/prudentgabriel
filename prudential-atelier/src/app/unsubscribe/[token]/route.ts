import { NextRequest, NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/email-consent";

function pageHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;background:#F7F2EC;font-family:Georgia,'Times New Roman',serif;color:#442913;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="480" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;background:#FFFdf9;">
          <tr>
            <td style="background:#442913;padding:24px;text-align:center;color:#C9A84C;letter-spacing:0.28em;font-size:11px;text-transform:uppercase;">
              Prudential Atelier
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 40px;font-size:16px;line-height:1.6;">
              ${body}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const result = await unsubscribeByToken(decodeURIComponent(token));
  if (!result) {
    return new NextResponse(
      pageHtml("Unsubscribe", "<p>This link is not valid.</p>"),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
  const copy = result.already
    ? "<p>You were already unsubscribed from marketing mail.</p>"
    : "<p>You are unsubscribed from marketing mail. Order and account messages may still arrive.</p>";
  return new NextResponse(pageHtml("Unsubscribed", copy), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const result = await unsubscribeByToken(decodeURIComponent(token));
  if (!result) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, already: result.already });
}
