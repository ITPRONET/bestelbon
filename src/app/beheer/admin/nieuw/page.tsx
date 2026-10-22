import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { adminOnly, TYPES } from "@/lib/admin";
import { eur } from "@/lib/money";
import { normVat } from "@/lib/vat";
import { TERMS_VERSION } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nieuwe klant" };

const s = (f: FormData, k: string, n = 100) => String(f.get(k) ?? "").trim().slice(0, n);
const slugify = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 40);

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
  const { data: taken } = await db.from("restaurants").select("id").eq("slug", slug).maybeSingle();
  if (taken) back("slugbezet");
  const { data: dup } = await db.from("companies").select("id").eq("vat_number", vat.display).maybeSingle();
  if (dup) redirect(`/beheer/admin/bedrijf/${dup.id}?fout=bestaat`);

  const plan = s(f, "plan") === "pro" ? "pro" : "standaard";
  const addr = { street: s(f, "street") || null, postcode: s(f, "postcode", 10) || null, city: s(f, "city", 60) || null };
  const { data: co, error: e1 } = await db.from("companies").insert({
    legal_name: s(f, "legal_name"), vat_number: vat.display, ...addr, contact_name: s(f, "contact_name", 80) || null,
    email, phone: s(f, "phone", 30) || null, plan, status: "installatie", started_on: s(f, "started_on") || undefined,
    ...(s(f, "aanvraag") ? { terms_version: s(f, "terms_version") || TERMS_VERSION, terms_accepted_at: s(f, "terms_at") || new Date().toISOString() } : {}),
  }).select("id").single();
  if (e1 || !co) back("opslaan");
  const { data: r, error: e2 } = await db.from("restaurants").insert({
    company_id: co!.id, name: zaak, slug, type: TYPES.includes(s(f, "type")) ? s(f, "type") : "Frituur", ...addr, phone: s(f, "phone", 30) || null,
  }).select("id").single();
  if (e2 || !r) back("opslaan");

  // Account voor de uitbater: uitnodiging per e-mail, of koppelen als het al bestaat.
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  let uid: string | undefined;
  const inv = await db.auth.admin.inviteUserByEmail(owner, { redirectTo: `${site}/auth/bevestig` });
  uid = inv.data.user?.id;
  if (!uid) {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    uid = list?.users.find((u) => u.email?.toLowerCase() === owner)?.id;
  }
  if (uid) await db.from("restaurant_members").insert({ restaurant_id: r!.id, user_id: uid, role: "eigenaar" });

  const cable = Math.max(0, Math.min(5, Number(s(f, "cable")) || 0));
  const wifi = Math.max(0, Math.min(5, Number(s(f, "wifi")) || 0));
  await db.from("installations").insert({ company_id: co!.id, restaurant_id: r!.id, printers_cable: cable, printers_wifi: wifi, planned_on: s(f, "planned_on") || null, status: s(f, "planned_on") ? "gepland" : "te_plannen", notes: s(f, "notes", 500) || null });

  if (f.get("invoice") === "on") {
    const { data: prices } = await db.from("prices").select("key, label, cents");
    const p = (k: string) => prices!.find((x) => x.key === k)!;
    const lines = [
      cable && { description: p("printer_kabel").label, qty: cable, unit_cents: p("printer_kabel").cents },
      wifi && { description: p("printer_wifi").label, qty: wifi, unit_cents: p("printer_wifi").cents },
      f.get("install") === "on" && { description: p("installatie").label, qty: 1, unit_cents: p("installatie").cents },
    ].filter(Boolean);
    if (lines.length) await db.rpc("create_invoice", { p_company: co!.id, p_lines: lines, p_note: `Opstart BestelBon voor ${zaak}` });
  }
  if (s(f, "aanvraag")) await db.from("signups").update({ status: "klant", company_id: co!.id }).eq("id", s(f, "aanvraag"));
  redirect(`/beheer/admin/bedrijf/${co!.id}?nieuw=${uid ? (inv.data.user ? "uitgenodigd" : "gekoppeld") : "geenaccount"}`);
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
            <label className="field">Printers met wifi<input name="wifi" type="number" min={0} max={5} defaultValue={a ? a.printers_wifi : 0} /></label>
            <label className="field">Installatiedatum<input name="planned_on" type="date" /></label>
            <label className="field" style={{ gridColumn: "1/-1" }}>Notities<textarea name="notes" defaultValue={v("message")} rows={2} placeholder="Router achter de toog, menu op foto ontvangen…" /></label>
          </div>
          <label className="check"><input type="checkbox" name="invoice" defaultChecked /> Meteen factuur maken voor de printers</label>
          <label className="check"><input type="checkbox" name="install" defaultChecked /> Installatie mee factureren</label>
          <p className="muted small" style={{ margin: 0 }}>De uitbater krijgt een e-mail om een wachtwoord te kiezen. Het maandabonnement factureer je via Facturen → Maandfacturen.</p>
          <div><button className="btn btn-primary">Klant aanmaken</button></div>
        </section>
      </form>
    </>
  );
}
