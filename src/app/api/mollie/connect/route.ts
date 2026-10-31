// Start koppelen: alleen voor wie de zaak mag beheren. State in een kortlevende cookie (CSRF).
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { userDb } from "@/lib/supabase-server";
import { authorizeUrl, mollieEnabled, siteUrl } from "@/lib/mollie";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rid = new URL(req.url).searchParams.get("rid") ?? "";
  if (!mollieEnabled() || !/^[0-9a-f-]{36}$/.test(rid)) return NextResponse.redirect(`${siteUrl()}/beheer/instellingen`);
  const db = await userDb();
  const { data: u } = await db.auth.getUser();
  if (!u.user) return NextResponse.redirect(`${siteUrl()}/beheer/login`);
  const { data: r } = await db.from("restaurants").select("id").eq("id", rid).maybeSingle(); // RLS: alleen eigen zaken
  if (!r) return NextResponse.redirect(`${siteUrl()}/beheer/instellingen`);
  const state = `${randomBytes(18).toString("base64url")}.${rid}`;
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("bb_mollie_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/mollie", maxAge: 900 });
  return res;
}
