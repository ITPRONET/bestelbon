import { redirect } from "next/navigation";
import { userDb } from "./supabase-server";

export type PanelRestaurant = { id: string; name: string; slug: string; company_id: string };

/** Signed-in user, the restaurants they may manage (admins: all) and the selected one (?zaak=slug). */
export async function panel(zaak?: string) {
  const db = await userDb();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) redirect("/beheer/login");
  const { data: adm } = await db.from("platform_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (adm) {
    // Het beheerdersaccount ziet alle zaken: alleen met tweestapsverificatie.
    const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") redirect("/beheer/2fa?verplicht=1");
  }
  let restaurants: PanelRestaurant[];
  if (adm) {
    restaurants = (await db.from("restaurants").select("id, name, slug, company_id").order("name")).data ?? [];
  } else {
    const { data } = await db.from("restaurants").select("id, name, slug, company_id, restaurant_members!inner(user_id)")
      .eq("restaurant_members.user_id", auth.user.id).order("name");
    restaurants = (data ?? []).map(({ id, name, slug, company_id }) => ({ id, name, slug, company_id }));
  }
  const current = restaurants.find((r) => r.slug === zaak) ?? restaurants[0] ?? null;
  return { db, user: auth.user, isAdmin: !!adm, restaurants, current };
}

/** Today's date in Brussels as YYYY-MM-DD. */
export const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Brussels" });
export const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const longDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
