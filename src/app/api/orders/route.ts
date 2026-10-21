import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/supabase";

export const runtime = "nodejs";

const Body = z.object({
  slug: z.string().min(3).max(40),
  mode: z.enum(["levering", "afhalen"]),
  payment: z.enum(["cash"]), // "online" komt met Mollie
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

  const { data: r } = await db.from("restaurants").select("id, name, is_open, delivery_fee_cents, min_order_cents").eq("slug", b.slug).maybeSingle();
  if (!r || !r.is_open) return NextResponse.json({ error: "Deze zaak neemt nu geen online bestellingen aan." }, { status: 409 });

  // Printers: is er minstens één online? Anders pauzeren we (zie stroomuitval-regels).
  const { data: printers } = await db.from("printers").select("id, role, copies, last_seen_at").eq("restaurant_id", r.id);
  const online = (printers ?? []).filter((p) => p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < PRINTER_TIMEOUT_MS);
  const allowWithout = ["true", "1", "yes", "ja"].includes((process.env.ALLOW_ORDERS_WITHOUT_PRINTER ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase());
  if (!online.length && !allowWithout) {
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
  const fee = b.mode === "levering" ? r.delivery_fee_cents : 0;
  if (b.mode === "levering" && subtotal < r.min_order_cents) {
    return NextResponse.json({ error: "Het minimum voor levering is nog niet bereikt." }, { status: 400 });
  }

  const { data: order, error } = await db.from("orders").insert({
    restaurant_id: r.id, business_day: new Date().toISOString().slice(0, 10), day_number: 0, // trigger zet de echte waarden
    mode: b.mode, requested_time: b.time, status: "in_wachtrij", payment_method: "cash", payment_status: "open",
    subtotal_cents: subtotal, delivery_fee_cents: fee, total_cents: subtotal + fee,
    customer_name: b.name, customer_phone: b.phone, customer_email: b.email,
    address: b.mode === "levering" ? b.address : null, postcode: b.mode === "levering" ? b.postcode : null, city: b.mode === "levering" ? b.city : null,
    note: b.note || null,
  }).select("id, day_number").single();
  if (error || !order) return NextResponse.json({ error: "Bestelling kon niet worden opgeslagen. Probeer opnieuw." }, { status: 500 });

  await db.from("order_lines").insert(lines.map((l) => ({ ...l, order_id: order.id, restaurant_id: r.id })));

  // Printjobs: keukenbon(nen), en bij levering een bezorgbon (of op de keukenprinter als er geen bezorgprinter is).
  const all = printers ?? [];
  const kitchen = all.filter((p) => p.role === "keuken");
  const delivery = all.filter((p) => p.role === "bezorging");
  const jobs: { printer_id: string; order_id: string; restaurant_id: string; kind: "keuken" | "bezorging" }[] = [];
  for (const p of kitchen) for (let i = 0; i < p.copies; i++) jobs.push({ printer_id: p.id, order_id: order.id, restaurant_id: r.id, kind: "keuken" });
  if (b.mode === "levering") {
    const targets = delivery.length ? delivery : kitchen.slice(0, 1);
    for (const p of targets) for (let i = 0; i < (delivery.length ? p.copies : 1); i++) jobs.push({ printer_id: p.id, order_id: order.id, restaurant_id: r.id, kind: "bezorging" });
  }
  if (jobs.length) await db.from("print_jobs").insert(jobs);

  return NextResponse.json({ id: order.id, number: order.day_number });
}
