import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/supabase";
import { normVat } from "@/lib/vat";
import { sendMail } from "@/lib/mail";
import { TERMS_VERSION } from "@/lib/legal";

export const runtime = "nodejs";

const str = (max: number) => z.string().trim().max(max);
const Body = z.object({
  plan: z.enum(["standaard", "pro"]),
  billing: z.enum(["maand", "jaar"]).default("maand"),
  printers_cable: z.coerce.number().int().min(0).max(5),
  printers_wifi: z.coerce.number().int().min(0).max(5),
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

  const row = {
    plan: b.plan, billing: b.billing, printers_cable: b.printers_cable, printers_wifi: b.printers_wifi,
    restaurant_name: b.restaurant_name, restaurant_type: b.restaurant_type || null, wanted_start: b.wanted_start || null, message: b.message || null, gks: b.gks ?? null,
    legal_name: b.legal_name, vat_number: vat.display, contact_name: b.contact_name, street: b.street, postcode: b.postcode, city: b.city,
    email: b.email.toLowerCase(), phone: b.phone, terms_version: TERMS_VERSION, ip_hash,
  };
  const { error } = await db.from("signups").insert(row);
  if (error) return NextResponse.json({ error: "Aanmelden is niet gelukt. Probeer opnieuw." }, { status: 500 });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const summary = [
    `Zaak: ${row.restaurant_name} (${row.restaurant_type ?? "-"})`, `Pakket: ${row.plan === "pro" ? "Pro" : "Standaard"} · ${row.billing === "jaar" ? "jaarlijks vooraf (10% korting)" : "maandelijks"}`,
    `Printers: ${row.printers_cable}× kabel, ${row.printers_wifi}× wifi`, `Gewenste start: ${row.wanted_start ?? "-"}`, `Witte kassa: ${row.gks === "ja" ? "ja" : row.gks === "weet_niet" ? "weet niet" : "nee"}`, "",
    `${row.legal_name} · ${row.vat_number}`, `${row.street}, ${row.postcode} ${row.city}`, `${row.contact_name} · ${row.phone} · ${row.email}`,
    row.message ? `\nOpmerking: ${row.message}` : "",
  ].join("\n");
  await Promise.all([
    sendMail({ to: process.env.ADMIN_EMAIL || "info@bestelbon.eu", replyTo: row.email, subject: `Nieuwe aanmelding: ${row.restaurant_name}`, text: `${summary}\n\nBekijk: ${site}/beheer/admin/aanvragen` }),
    sendMail({ to: row.email, subject: "Je aanmelding bij BestelBon", text: `Beste ${row.contact_name},\n\nBedankt voor je aanmelding. We bellen je binnen één werkdag om de installatie af te spreken.\n\n${summary}\n\nJe ging akkoord met de algemene voorwaarden (${site}/voorwaarden) en de verwerkersovereenkomst (${site}/verwerkersovereenkomst).\n\nMet vriendelijke groeten,\nBestelBon\ninfo@bestelbon.eu` }),
  ]);
  return NextResponse.json({ ok: true });
}
