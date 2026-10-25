import { userDb } from "@/lib/supabase-server";

// CSV of all orders of one restaurant in a period, for the accountant or the VAT administration.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const zaak = u.searchParams.get("zaak") ?? "";
  const van = u.searchParams.get("van") ?? "";
  const tot = u.searchParams.get("tot") ?? "";
  const db = await userDb();
  const { data: r } = await db.from("restaurants").select("id, name, slug").eq("slug", zaak).maybeSingle();
  if (!r) return new Response("Niet gevonden", { status: 404 });
  let q = db.from("orders").select("business_day, day_number, created_at, mode, requested_time, status, payment_method, payment_status, subtotal_cents, delivery_fee_cents, total_cents, order_lines ( item_name, options, qty, unit_cents )")
    .eq("restaurant_id", r.id).order("created_at");
  if (/^\d{4}-\d{2}-\d{2}$/.test(van)) q = q.gte("business_day", van);
  if (/^\d{4}-\d{2}-\d{2}$/.test(tot)) q = q.lte("business_day", tot);
  const { data, error } = await q; // RLS: alleen eigen zaak
  if (error) return new Response("Geen toegang", { status: 403 });
  const c = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const n = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
  const rows = [["Dag", "Nr", "Besteld om", "Soort", "Tijdstip", "Status", "Betaling", "Betaalstatus", "Artikelen", "Subtotaal", "Leverkost", "Totaal"].map(c).join(";")];
  for (const o of data ?? []) {
    const items = (o.order_lines as { item_name: string; options: string[]; qty: number; unit_cents: number }[])
      .map((l) => `${l.qty}x ${l.item_name}${l.options.length ? ` (${l.options.join(", ")})` : ""} ${n(l.qty * l.unit_cents)}`).join(" | ");
    const t = new Date(o.created_at).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });
    rows.push([o.business_day, o.day_number, t, o.mode, o.requested_time, o.status, o.payment_method, o.payment_status, items, n(o.subtotal_cents), n(o.delivery_fee_cents), n(o.total_cents)].map(c).join(";"));
  }
  return new Response("﻿" + rows.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bestellingen-${r.slug}-${van || "begin"}-${tot || "nu"}.csv"` } });
}
