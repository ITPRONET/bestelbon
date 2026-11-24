import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/supabase";
import { normVat } from "@/lib/vat";
import { sendMail } from "@/lib/mail";
import { signupMail } from "@/lib/signup-mail";
import { createCustomer, freeSlug } from "@/lib/customers";
import { TYPES } from "@/lib/admin";
import { TERMS_VERSION } from "@/lib/legal";
import { packageOf, setupText } from "@/lib/setup";

export const runtime = "nodejs";

const str = (max: number) => z.string().trim().max(max);
const Body = z.object({
  plan: z.enum(["standaard", "pro"]),
  billing: z.enum(["maand", "jaar"]).default("maand"),
  setup: z.object({
    printers: z.union([z.literal(1), z.literal(2)]),
    conns: z.array(z.enum(["kabel", "powerline", "onbekend"])).min(1).max(2),
    install: z.enum(["zelf", "ter_plaatse"]),
  }),
  restaurant_name: str(60).min(2), restaurant_type: str(40).optional(),
  wanted_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  message: str(1000).optional(),
  gks: z.enum(["ja", "nee", "weet_niet"]).optional(),
  legal_name: str(100).min(2), vat_number: str(30).min(4), contact_name: str(80).min(2),
  street: str(100).min(3), postcode: str(10).min(4), city: str(60).min(2),
  email: str(120).email(), phone: str(30).min(6),
  terms: z.literal("on"), website: z.string().max(0).optional(), t: z.number(),
});

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) {
    const f = p.error.issues[0]?.path[0];
    const msg = f === "terms" ? "Vink de voorwaarden aan." : f === "email" ? "Vul een geldig e-mailadres in." : "Controleer de verplichte velden.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const b = p.data;
  if (b.t < 4000) return NextResponse.json({ error: "Probeer het nog eens." }, { status: 400 }); // bots vullen te snel in
  const vat = normVat(b.vat_number);
  if (!vat.ok) return NextResponse.json({ error: "Dit btw-nummer klopt niet. Controleer het nummer." }, { status: 400 });

  const db = adminDb();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ip_hash = createHash("sha256").update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")).digest("hex").slice(0, 32);
  const { count } = await db.from("signups").select("id", { count: "exact", head: true }).eq("ip_hash", ip_hash).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 5) return NextResponse.json({ error: "Te veel aanmeldingen. Mail ons op info@bestelbon.eu." }, { status: 429 });

  if (b.setup.conns.length < b.setup.printers) return NextResponse.json({ error: "Kies voor elke printer hoe die aan internet raakt." }, { status: 400 });
  const pk = packageOf(b.setup);
  const row = {
    plan: b.plan, billing: b.billing, printers_cable: pk.cable, printers_wifi: 0, printers_powerline: pk.powerline, powerline_adapters: pk.adapters,
    install_mode: b.setup.install, printer_setup: { ...b.setup, conns: pk.conns },
    restaurant_name: b.restaurant_name, restaurant_type: b.restaurant_type || null, wanted_start: b.wanted_start || null, message: b.message || null, gks: b.gks ?? null,
    legal_name: b.legal_name, vat_number: vat.display, contact_name: b.contact_name, street: b.street, postcode: b.postcode, city: b.city,
    email: b.email.toLowerCase(), phone: b.phone, terms_version: TERMS_VERSION, ip_hash,
  };
  const { data: sg, error } = await db.from("signups").insert(row).select("id").single();
  if (error || !sg) return NextResponse.json({ error: "Aanmelden is niet gelukt. Probeer opnieuw." }, { status: 500 });

  // Meteen een klant aanmaken met login, zodat de uitbater al zijn menu kan invullen.
  // Bestaat het btw-nummer al, dan doet de beheerder het zelf (geen overname van een bestaand account).
  const { data: dup } = await db.from("companies").select("id").eq("vat_number", vat.display).maybeSingle();
  const made = dup ? null : await createCustomer(db, {
    legal_name: row.legal_name, vat: vat.display, street: row.street, postcode: row.postcode, city: row.city, contact_name: row.contact_name,
    email: row.email, phone: row.phone, owner_email: row.email, plan: row.plan, billing: row.billing,
    zaak: row.restaurant_name, slug: await freeSlug(db, row.restaurant_name), type: TYPES.includes(row.restaurant_type ?? "") ? row.restaurant_type! : "Frituur",
    cable: pk.cable, pl: pk.powerline, adapters: pk.adapters, install_mode: b.setup.install, printer_setup: row.printer_setup,
    notes: row.message, terms: { version: TERMS_VERSION, at: new Date().toISOString() }, signup_id: sg.id,
  }).catch((e) => { console.error("auto klant", e); return null; });
  const panel = made?.ok && made.account !== "geenaccount";

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const summary = [
    `Zaak: ${row.restaurant_name} (${row.restaurant_type ?? "-"})`, `Pakket: ${row.plan === "pro" ? "Pro" : "Standaard"} · ${row.billing === "jaar" ? "jaarlijks vooraf (10% korting)" : "maandelijks"}`,
    `Printers: ${setupText(b.setup)}`, `Gewenste start: ${row.wanted_start ?? "-"}`, `Witte kassa: ${row.gks === "ja" ? "ja" : row.gks === "weet_niet" ? "weet niet" : "nee"}`, "",
    `${row.legal_name} · ${row.vat_number}`, `${row.street}, ${row.postcode} ${row.city}`, `${row.contact_name} · ${row.phone} · ${row.email}`,
    row.message ? `\nOpmerking: ${row.message}` : "",
  ].join("\n");
  await Promise.all([
    sendMail({ to: process.env.ADMIN_EMAIL || "info@bestelbon.eu", replyTo: row.email, subject: `Nieuwe aanmelding: ${row.restaurant_name}`, text: `${summary}\n\n${made?.ok ? `Klant automatisch aangemaakt (login: ${made.account}). Opstartfactuur nog maken: ${site}/beheer/admin/bedrijf/${made.companyId}` : `Nog geen klant aangemaakt${dup ? " (btw-nummer bestaat al)" : ""}: ${site}/beheer/admin/aanvragen`}` }),
    sendMail({ to: row.email, ...signupMail({
      contact: row.contact_name, zaak: row.restaurant_name, type: row.restaurant_type, plan: row.plan === "pro" ? "pro" : "standaard", billing: row.billing === "jaar" ? "jaar" : "maand",
      printers: setupText(b.setup), start: row.wanted_start, gks: row.gks === "ja" ? "ja" : row.gks === "weet_niet" ? "weet ik nog niet" : "nee",
      legal: row.legal_name, vat: row.vat_number, address: `${row.street}, ${row.postcode} ${row.city}`, phone: row.phone, email: row.email, message: row.message,
    }, site, panel ? `${site}/beheer/login` : null) }),
  ]);
  return NextResponse.json({ ok: true });
}
