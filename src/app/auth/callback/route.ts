import { NextResponse } from "next/server";
import { userDb } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const db = await userDb();
    await db.auth.exchangeCodeForSession(code);
  }
  const res = NextResponse.redirect(new URL("/beheer", url.origin));
  res.cookies.set("bb_act", String(Date.now()), { path: "/", maxAge: 86400, sameSite: "lax", secure: true });
  return res;
}
