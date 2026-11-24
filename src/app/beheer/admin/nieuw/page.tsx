import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { adminOnly, TYPES } from "@/lib/admin";
import { eur } from "@/lib/money";
import { normVat } from "@/lib/vat";
import { TERMS_VERSION } from "@/lib/legal";
import { RESERVED_SLUGS } from "@/lib/reserved";
import { createCustomer, slugify, startInvoice } from "@/lib/customers";
import { adminFeeWaived, ADMIN_FREE_LABEL } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nieuwe klant" };

const s = (f: FormData, k: string, n = 100) => String(f.get(k) ?? "").trim().slice(0, n);

async function create(f: FormData) {
  "use server";
  const db = await adminOnly();
  const back = (fout: string) => redirect(`/beheer/admin/nieuw?fout=${fout}`);
  const vat = normVat(s(f, "vat_number"));
  if (!vat.ok) back("btw");
  const email = s(f, "email").toLowerCase();
  const owner = (s(f, "owner_email") || email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner)) back("mail");
  const zaak = s(f, "restaurant") || s(f, "legal_name");
  const slug = slugify(s(f, "slug") || zaak);
  if (slug.length < 3) back("slug");
  if (RESERVED_SLUGS.has(slug)) back("slugbezet");
  const { data: taken } = await db.from("restaurants").select("id").eq("slug", slug).maybeSingle();
  if (taken) back("slugbezet");
  const { data: dup } = await db.from("companies").select("id").eq("vat_number", vat.display).maybeSingle();
  if (dup) redirect(`/beheer/admin/bedrijf/${dup.id}?fout=bestaat`);

  const cable = Math.max(0, Math.min(5, Number(s(f, "cable")) || 0));
  const pl = Math.max(0, Math.min(5, Number(s(f, "pl")) || 0));
  const adapters = Math.max(0, Math.min(10, Number(s(f, "adapters")) || (pl ? pl + 1 : 0)));
  const installMode = s(f, "install_mode") === "ter_plaatse" ? "ter_plaatse" : "zelf";
  const { data: sg } = s(f, "aanvraag") ? await db.from("signups").select("printer_setup").eq("id", s(f, "aanvraag")).maybeSingle() : { data: null };
  const res = await createCustomer(db, {
    legal_name: s(f, "legal_name"), vat: vat.display, street: s(f, "street") || null, postcode: s(f, "postcode", 10) || null, city: s(f, "city", 60) || null,
    contact_name: s(f, "contact_name", 80) || null, email, phone: s(f, "phone", 30) || null, owner_email: owner,
    plan: s(f, "plan") === "pro" ? "pro" : "standaard", billing: s(f, "billing") === "jaar" ? "jaar" : "maand", started_on: s(f, "started_on") || undefined,
    zaak, slug, type: TYPES.includes(s(f, "type")) ? s(f, "type") : "Frituur",
    cable, pl, adapters, install_mode: installMode, printer_setup: sg?.printer_setup ?? null, planned_on: s(f, "planned_on") || null, notes: s(f, "notes", 500) || null,
    terms: s(f, "aanvraag") ? { version: s(f, "terms_version") || TERMS_VERSION, at: s(f, "terms_at") || new Date().toISOString() } : undefined,
    signup_id: s(f, "aanvraag") || undefined,
  });
  if (!res.ok) back("opslaan");
  if (f.get("invoice") === "on") await startInvoice(db, res.companyId!, zaak, { printers: cable + pl, adapters, onSite: installMode === "ter_plaatse", adminFee: f.get("admin") === "on" });
  redirect(`/beheer/admin/bedrijf/${res.companyId}?nieuw=${res.account}`);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ fout?: string; aanvraag?: string }> }) {
  const sp = await searchParams;
  const db = await adminOnly();
  const { data: prices } = await db.from("prices").select("key, label, cents").order("cents");
  const { data: a } = sp.aanvraag ? await db.from("signups").select("*").eq("id", sp.aanvraag).maybeSingle() : { data: null };
  const v = (k: string) => (a?.[k] ?? "") as string;
  const errors: Record<string, string> = {
    btw: "Het btw-nummer klopt niet.", mail: "Controleer de e-mailadressen.", slug: "Kies een langere webadres-naam.",
    slugbezet: "Dit webadres is al in gebruik. Kies een andere naam.", opslaan: "Opslaan is niet gelukt.",
  };
  return (
    <>
      <AdminNav active="nieuw" />
      <h1 className="ph">Nieuwe klant</h1>
      {sp.fout && <div className="alert">{errors[sp.fout] ?? "Er ging iets mis."}</div>}
      {a && <div className="okmsg">Gegevens overgenomen uit de aanvraag van {a.contact_name}. Controleer ze en klik op “Klant aanmaken”.</div>}
      <form action={create} className="sgrid">
        {a && <><input type="hidden" name="aanvraag" value={a.id} /><input type="hidden" name="terms_version" value={a.terms_version} /><input type="hidden" name="terms_at" value={a.terms_accepted_at} /></>}
        <section className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <h2 className="h2">Bedrijf</h2>
          <div className="fgrid">
            <label className="field" style={{ gridColumn: "1/-1" }}>Bedrijfsnaam<input name="legal_name" defaultValue={v("legal_name")} required placeholder="Frituur Het Pleintje BV" /></label>
            <label className="field">Btw-nummer<input name="vat_number" defaultValue={v("vat_number")} required placeholder="BE 0123.456.789" /></label>
            <label className="field">Contactpersoon<input name="contact_name" defaultValue={v("contact_name")} /></label>
            <label className="field" style={{ gridColumn: "1/-1" }}>Straat en nummer<input name="street" defaultValue={v("street")} /></label>
            <label className="field">Postcode<input name="postcode" defaultValue={v("postcode")} /></label>
            <label className="field">Gemeente<input name="city" defaultValue={v("city")} /></label>
            <label className="field">E-mail voor facturen<input name="email" defaultValue={v("email")} type="email" required /></label>
            <label className="field">Telefoon<input name="phone" defaultValue={v("phone")} /></label>
          </div>
          <h2 className="h2" style={{ marginTop: 8 }}>Abonnement</h2>
          <div className="fgrid">
            <label className="field">Pakket<select name="plan" defaultValue={v("plan") || "standaard"}>{prices?.filter((p) => ["standaard", "pro"].includes(p.key)).map((p) => <option key={p.key} value={p.key}>{p.key === "pro" ? "Pro" : "Standaard"} · {eur(p.cents)}/maand</option>)}</select></label>
            <label className="field">Start abonnement<input name="started_on" type="date" defaultValue={v("wanted_start")} /></label>
            <label className="field">Betaling<select name="billing" defaultValue={v("billing") || "maand"}><option value="maand">Maandelijks</option><option value="jaar">Jaarlijks vooraf (10% korting)</option></select></label>
          </div>
        </section>
        <section className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <h2 className="h2">Zaak</h2>
          <div className="fgrid">
            <label className="field" style={{ gridColumn: "1/-1" }}>Naam van de zaak<input name="restaurant" defaultValue={v("restaurant_name")} placeholder="Frituur Het Pleintje" /></label>
            <label className="field">Soort<select name="type" defaultValue={v("restaurant_type") || "Frituur"}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="field">Webadres (bestelbon.eu/…)<input name="slug" placeholder="frituurhetpleintje" pattern="[a-z0-9]*" /></label>
            <label className="field" style={{ gridColumn: "1/-1" }}>E-mail van de uitbater (login)<input name="owner_email" type="email" placeholder="leeg = zelfde als factuur-e-mail" /></label>
          </div>
          <h2 className="h2" style={{ marginTop: 8 }}>Installatie</h2>
          <div className="fgrid">
            <label className="field">Printers met kabel<input name="cable" type="number" min={0} max={5} defaultValue={a ? a.printers_cable : 1} /></label>
            <label className="field">Printers via powerline<input name="pl" type="number" min={0} max={5} defaultValue={a ? (a.printers_powerline ?? 0) : 0} /></label>
            <label className="field">Powerline-adapters<input name="adapters" type="number" min={0} max={10} defaultValue={a ? (a.powerline_adapters ?? 0) : 0} /></label>
            <label className="field">Installatie<select name="install_mode" defaultValue={a?.install_mode ?? "zelf"}><option value="zelf">Zelf (pakket)</option><option value="ter_plaatse">Ter plaatse</option></select></label>
            <label className="field">Installatiedatum<input name="planned_on" type="date" /></label>
            <label className="field" style={{ gridColumn: "1/-1" }}>Notities<textarea name="notes" defaultValue={v("message")} rows={2} placeholder="Router achter de toog, menu op foto ontvangen…" /></label>
          </div>
          <label className="check"><input type="checkbox" name="invoice" defaultChecked /> Meteen factuur maken voor printers, adapters en installatie</label>
          <label className="check"><input type="checkbox" name="admin" defaultChecked /> Administratieve kosten (€ 99){adminFeeWaived() ? ` – gratis tot ${ADMIN_FREE_LABEL}` : ""}</label>
          <p className="muted small" style={{ margin: 0 }}>De uitbater krijgt een e-mail om een wachtwoord te kiezen. Het maandabonnement factureer je via Facturen → Maandfacturen.</p>
          <div><button className="btn btn-primary">Klant aanmaken</button></div>
        </section>
      </form>
    </>
  );
}
