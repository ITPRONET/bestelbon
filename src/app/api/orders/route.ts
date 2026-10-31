import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/supabase";
import { queueTickets } from "@/lib/print-jobs";
import { createPayment, onlineReady, siteUrl } from "@/lib/mollie";
import { cleanPostcode, findZone, openState, timeSlots, weekMinute } from "@/lib/hours";

export const runtime = "nodejs";

const Body = z.object({
  slug: z.string().min(3).max(40),
  mode: z.enum(["levering", "afhalen"]),
  payment: z.enum(["cash", "online"]).default("cash"),
  time: z.string().max(40).default("Zo snel mogelijk"),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(30),
  email: z.string().trim().email().max(120),
  address: z.string().trim().max(120).optional(),
  postcode: z.string().trim().max(10).optional(),
  city: z.string().trim().max(60).optional(),
  note: z.string().trim().max(200).optional(),
  lines: z.array(z.object({ itemId: z.string().uuid(), choiceIds: z.array(z.string().uuid()).max(20), qty: z.number().int().min(1).max(50) })).min(1).max(40),
});

const PRINTER_TIMEOUT_MS = 2 * 60 * 1000;

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Controleer je gegevens en probeer opnieuw." }, { status: 400 });
  const b = parsed.data;
  if (b.mode === "levering" && (!b.address || !b.postcode || !b.city)) {
    return NextResponse.json({ error: "Vul je adres in voor levering." }, { status: 400 });
  }
  const db = adminDb();

  // Tegen spam: maximaal 6 bestellingen per 15 minuten vanaf hetzelfde adres.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ip_hash = createHash("sha256").update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")).digest("hex").slice(0, 32);
  const { count: recent } = await db.from("orders").select("id", { count: "exact", head: true }).eq("ip_hash", ip_hash).gte("created_at", new Date(Date.now() - 15 * 60_000).toISOString());
  if ((recent ?? 0) >= 6) return NextResponse.json({ error: "Te veel bestellingen na elkaar. Wacht even of bel de zaak." }, { status: 429 });

  const { data: r } = await db.from("restaurants").select("id, slug, name, is_open, delivery_fee_cents, min_order_cents, prep_minutes").eq("slug", b.slug).maybeSingle();
  if (!r || !r.is_open) return NextResponse.json({ error: "Deze zaak neemt nu geen online bestellingen aan." }, { status: 409 });
  const online = b.payment === "online";
  if (online && !(await onlineReady(r.id))) return NextResponse.json({ error: "Online betalen is bij deze zaak nu niet mogelijk. Kies betalen bij levering of afhaling." }, { status: 409 });

  // Openingsuren en gekozen tijdstip (een paar minuten speling voor wie lang over de bestelling deed).
  const [{ data: hours }, { data: zones }] = await Promise.all([
    db.from("opening_hours").select("weekday, opens, closes").eq("restaurant_id", r.id),
    db.from("delivery_zones").select("postcode, fee_cents, min_order_cents").eq("restaurant_id", r.id),
  ]);
  const now = weekMinute();
  const allowed = new Set([...timeSlots(hours ?? [], r.prep_minutes, now), ...timeSlots(hours ?? [], r.prep_minutes, now - 10)]);
  if (!allowed.size) return NextResponse.json({ error: `De zaak is gesloten. ${openState(hours ?? [], now).label}.` }, { status: 409 });
  if (!allowed.has(b.time)) return NextResponse.json({ error: "Dit tijdstip kan niet meer. Kies een ander tijdstip." }, { status: 400 });

  // Bezorgzones: als de zaak zones heeft, bepalen die leverkost en minimum.
  let feeCents = r.delivery_fee_cents, minCents = r.min_order_cents;
  if (b.mode === "levering" && zones?.length) {
    const z = findZone(zones, b.postcode ?? "");
    if (!z) return NextResponse.json({ error: `We leveren niet in ${cleanPostcode(b.postcode ?? "") || "deze gemeente"}. Kies afhalen of bel de zaak.` }, { status: 400 });
    feeCents = z.fee_cents; minCents = z.min_order_cents;
  }

  // Printers: is er minstens één online? Anders pauzeren we (zie stroomuitval-regels).
  const { data: printers } = await db.from("printers").select("id, last_seen_at").eq("restaurant_id", r.id);
  const live = (printers ?? []).filter((p) => p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < PRINTER_TIMEOUT_MS);
  const allowWithout = ["true", "1", "yes", "ja"].includes((process.env.ALLOW_ORDERS_WITHOUT_PRINTER ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase());
  if (!live.length && !allowWithout) {
    return NextResponse.json({ error: "Online bestellen is even niet mogelijk. Bel de zaak rechtstreeks." }, { status: 503 });
  }

  // Prijzen altijd opnieuw uit de database halen, nooit uit de browser.
  const itemIds = [...new Set(b.lines.map((l) => l.itemId))];
  const { data: items } = await db.from("menu_items")
    .select("id, name, price_cents, available, option_groups ( id, name, required, multi, option_choices ( id, name, extra_cents ) )")
    .eq("restaurant_id", r.id).in("id", itemIds);
  type It = { id: string; name: string; price_cents: number; available: boolean; option_groups: { id: string; name: string; required: boolean; multi: boolean; option_choices: { id: string; name: string; extra_cents: number }[] }[] };
  const byId = new Map(((items ?? []) as It[]).map((i) => [i.id, i]));

  const lines: { item_id: string; item_name: string; options: string[]; unit_cents: number; qty: number }[] = [];
  for (const l of b.lines) {
    const it = byId.get(l.itemId);
    if (!it || !it.available) return NextResponse.json({ error: "Een gerecht is niet meer beschikbaar. Vernieuw de pagina." }, { status: 409 });
    let unit = it.price_cents;
    const opts: string[] = [];
    for (const g of it.option_groups) {
      const picked = g.option_choices.filter((c) => l.choiceIds.includes(c.id));
      if (g.required && picked.length === 0) return NextResponse.json({ error: `Kies ${g.name.toLowerCase()} voor ${it.name}.` }, { status: 400 });
      if (!g.multi && picked.length > 1) return NextResponse.json({ error: `Kies één ${g.name.toLowerCase()} voor ${it.name}.` }, { status: 400 });
      for (const c of picked) { unit += c.extra_cents; opts.push(c.name); }
    }
    lines.push({ item_id: it.id, item_name: it.name, options: opts, unit_cents: unit, qty: l.qty });
  }
  const subtotal = lines.reduce((s, l) => s + l.unit_cents * l.qty, 0);
  const fee = b.mode === "levering" ? feeCents : 0;
  if (b.mode === "levering" && subtotal < minCents) {
    return NextResponse.json({ error: "Het minimum voor levering is nog niet bereikt." }, { status: 400 });
  }

  const { data: order, error } = await db.from("orders").insert({
    restaurant_id: r.id, business_day: new Date().toISOString().slice(0, 10), day_number: 0, // trigger zet de echte waarden
    mode: b.mode, requested_time: b.time, status: online ? "wacht_op_betaling" : "in_wachtrij", payment_method: online ? "online" : "cash", payment_status: "open",
    subtotal_cents: subtotal, delivery_fee_cents: fee, total_cents: subtotal + fee,
    customer_name: b.name, customer_phone: b.phone, customer_email: b.email,
    address: b.mode === "levering" ? b.address : null, postcode: b.mode === "levering" ? b.postcode : null, city: b.mode === "levering" ? b.city : null,
    note: b.note || null, ip_hash,
  }).select("id, day_number").single();
  if (error || !order) return NextResponse.json({ error: "Bestelling kon niet worden opgeslagen. Probeer opnieuw." }, { status: 500 });

  await db.from("order_lines").insert(lines.map((l) => ({ ...l, order_id: order.id, restaurant_id: r.id })));

  if (online) {
    // Betaling bij Mollie op het account van de zaak. Bonnen printen pas als Mollie "betaald" meldt (webhook).
    try {
      const pay = await createPayment(r.id, { orderId: order.id, number: order.day_number, restaurantName: r.name, cents: subtotal + fee, redirectUrl: `${siteUrl()}/${r.slug}/bestelling/${order.id}` });
      if (!pay.checkoutUrl) throw new Error("geen checkout");
      await db.from("orders").update({ mollie_payment_id: pay.id }).eq("id", order.id);
      return NextResponse.json({ id: order.id, number: order.day_number, checkoutUrl: pay.checkoutUrl });
    } catch (e) {
      console.error("mollie create", e);
      await db.from("orders").update({ status: "geannuleerd", payment_status: "mislukt" }).eq("id", order.id);
      return NextResponse.json({ error: "Online betalen lukt nu niet. Kies betalen bij levering of afhaling, of probeer het later opnieuw." }, { status: 502 });
    }
  }

  await queueTickets(order.id, r.id, b.mode);
  return NextResponse.json({ id: order.id, number: order.day_number });
}
