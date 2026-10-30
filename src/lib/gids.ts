// BestelBon-gids: restaurants that opted in, found by postcode.
// Postcode coordinates: bpost postcode list with OpenStreetMap coordinates (github.com/jief/zipcode-belgium), averaged per postcode.
import PC from "./postcodes-be.json";
import { notFound } from "next/navigation";
import { adminDb } from "./supabase";
import { userDb } from "./supabase-server";
import { openState, weekMinute, type HourRow } from "./hours";

const P = PC as unknown as Record<string, [number, number, string]>;
export const pcInfo = (pc: string) => (P[pc] ? { lat: P[pc][0], lng: P[pc][1], name: P[pc][2] } : null);

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const PICKUP_KM = 8;
const NO_ZONES_DELIVERY_KM = 5;

export type GidsZaak = {
  slug: string; name: string; type: string; city: string | null; logo: string | null; accent: string;
  km: number | null; delivers: boolean; fee: number; min: number; eta: number;
  state: "open" | "later" | "dicht"; label: string;
};

export async function gidsPublic() {
  const { data } = await adminDb().from("platform_settings").select("gids_public").eq("id", 1).maybeSingle();
  return !!data?.gids_public;
}

export async function gidsFor(pc: string) {
  const here = pcInfo(pc);
  if (!here) return null;
  const { data } = await adminDb().from("restaurants")
    .select("slug, name, type, city, postcode, logo_path, brand_accent, delivery_fee_cents, min_order_cents, prep_minutes, is_open, companies!inner ( status, plan ), opening_hours ( weekday, opens, closes ), delivery_zones ( postcode, fee_cents, min_order_cents )")
    .eq("in_gids", true).in("companies.status", ["actief", "achterstallig"]);
  const now = weekMinute();
  const list: GidsZaak[] = [];
  for (const r of data ?? []) {
    const co = r.companies as unknown as { plan: string };
    const zones = (r.delivery_zones ?? []) as { postcode: string; fee_cents: number; min_order_cents: number }[];
    const at = r.postcode ? pcInfo(r.postcode) : null;
    const dist = at ? km(here, at) : null;
    const zone = zones.find((z) => z.postcode === pc);
    const delivers = zones.length ? !!zone : dist !== null && dist <= NO_ZONES_DELIVERY_KM;
    if (!delivers && (dist === null || dist > PICKUP_KM)) continue;
    const st = openState((r.opening_hours ?? []) as HourRow[], now);
    const state: GidsZaak["state"] = !r.is_open ? "dicht" : st.open ? "open" : st.preorder ? "later" : "dicht";
    list.push({
      slug: r.slug, name: r.name, type: r.type, city: r.city, accent: r.brand_accent,
      logo: co.plan === "pro" && r.logo_path ? r.logo_path : null,
      km: dist === null ? null : Math.round(dist * 10) / 10, delivers,
      fee: zone?.fee_cents ?? r.delivery_fee_cents, min: zone?.min_order_cents ?? r.min_order_cents,
      eta: r.prep_minutes + (delivers ? 15 : 0),
      state, label: !r.is_open ? "Neemt nu geen online bestellingen aan" : st.always ? "Open" : st.label,
    });
  }
  // Volgorde: eerst open, dan vooraf bestellen, dan gesloten; binnen elke groep op afstand. Niemand betaalt voor een hogere plaats.
  const rank = { open: 0, later: 1, dicht: 2 };
  list.sort((a, b) => rank[a.state] - rank[b.state] || (a.km ?? 99) - (b.km ?? 99) || a.name.localeCompare(b.name));
  return { here: { pc, ...here }, levering: list.filter((z) => z.delivers), afhalen: list.filter((z) => !z.delivers || (z.km !== null && z.km <= PICKUP_KM)) };
}

/** Until the guide is switched on, only the platform admin sees it. */
export async function guard() {
  if (await gidsPublic()) return true;
  const db = await userDb();
  const { data } = await db.auth.getUser();
  if (!data.user) notFound();
  const { data: adm } = await db.from("platform_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!adm) notFound();
  return false;
}

