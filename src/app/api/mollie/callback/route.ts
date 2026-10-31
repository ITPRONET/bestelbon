import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { userDb } from "@/lib/supabase-server";
import { connect, siteUrl } from "@/lib/mollie";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const state = q.get("state") ?? "", code = q.get("code") ?? "";
  const jar = await cookies();
  const expected = jar.get("bb_mollie_state")?.value ?? "";
  const back = (slug: string | null, r: string) => {
    const res = NextResponse.redirect(`${siteUrl()}/beheer/instellingen?${slug ? `zaak=${slug}&` : ""}mollie=${r}#betalen`);
    res.cookies.set("bb_mollie_state", "", { path: "/api/mollie", maxAge: 0 });
    return res;
  };
  const same = state.length === expected.length && state.length > 0 && timingSafeEqual(Buffer.from(state), Buffer.from(expected));
  if (!same) return back(null, "fout");
  const rid = state.split(".")[1];

  const db = await userDb();
  const { data: u } = await db.auth.getUser();
  if (!u.user) return NextResponse.redirect(`${siteUrl()}/beheer/login`);
  const { data: r } = await db.from("restaurants").select("id, slug").eq("id", rid).maybeSingle();
  if (!r) return back(null, "fout");
  if (q.get("error") || !code) return back(r.slug, "geannuleerd");
  try {
    await connect(r.id, code);
    return back(r.slug, "ok");
  } catch (e) {
    console.error("mollie connect", e);
    return back(r.slug, "fout");
  }
}
