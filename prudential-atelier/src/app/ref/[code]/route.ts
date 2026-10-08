import { NextResponse } from "next/server";

export async function GET(request: Request, props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const origin = new URL(request.url).origin;
  const code = params.code;
  const res = NextResponse.redirect(`${origin}/auth/register?ref=${encodeURIComponent(code)}`);

  res.cookies.set("pa_ref_code", code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return res;
}
