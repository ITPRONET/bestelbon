import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { adminOnly } from "@/lib/admin";
import { eur } from "@/lib/money";
import { toCents, fromCents } from "@/lib/euro";
import { seller } from "@/lib/invoice";
import { normVat } from "@/lib/vat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mijn gegevens" };

const s = (f: FormData, k: string, n = 100) => String(f.get(k) ?? "").trim().slice(0, n);

async function save(f: FormData) {
  "use server";
  const db = await adminOnly();
  const vat = normVat(s(f, "vat"));
  const iban = s(f, "iban").toUpperCase().replace(/\s/g, "");
  const seller = {
    name: s(f, "name"), street: s(f, "street"), postcode: s(f, "postcode", 10), city: s(f, "city", 60),
    vat: s(f, "vat") ? vat.display : "", iban: iban.replace(/(.{4})/g, "$1 ").trim(), bic: s(f, "bic", 11).toUpperCase(), email: s(f, "email"),
    vat_rate: Number(s(f, "vat_rate")) || 21, due_days: Math.max(0, Math.min(60, Number(s(f, "due_days")) || 14)),
  };
  await db.from("platform_settings").update({ seller, updated_at: new Date().toISOString() }).eq("id", 1);
  redirect(`/beheer/admin/gegevens?ok=1${s(f, "vat") && !vat.ok ? "&btw=1" : ""}`);
}

async function savePrices(f: FormData) {
  "use server";
  const db = await adminOnly();
  for (const k of ["standaard", "pro", "printer_kabel", "printer_wifi", "installatie", "administratie"]) {
    const c = toCents(f.get(k));
    if (c !== null) await db.from("prices").update({ cents: c }).eq("key", k);
  }
  redirect("/beheer/admin/gegevens?ok=1");
}

async function saveGids(f: FormData) {
  "use server";
  const db = await adminOnly();
  await db.from("platform_settings").update({ gids_public: f.get("gids_public") === "on", updated_at: new Date().toISOString() }).eq("id", 1);
  redirect("/beheer/admin/gegevens?ok=1");
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; btw?: string }> }) {
  const sp = await searchParams;
  const db = await adminOnly();
  const [s0, { data: prices }, { data: ps }, { count: inGids }] = await Promise.all([
    seller(), db.from("prices").select("key, label, cents").order("cents"),
    db.from("platform_settings").select("gids_public").eq("id", 1).maybeSingle(),
    db.from("restaurants").select("id", { count: "exact", head: true }).eq("in_gids", true),
  ]);
  return (
    <>
      <AdminNav active="gegevens" />
      <h1 className="ph">Mijn gegevens</h1>
      {sp.ok && <div className="okmsg">Opgeslagen.</div>}
      {sp.btw && <div className="alert">Let op: het btw-nummer lijkt niet te kloppen.</div>}
      {(!s0.iban || !s0.vat || !s0.street) && <div className="alert">Vul je adres, btw-nummer en rekeningnummer in. Ze staan op elke factuur.</div>}
      <div className="sgrid">
        <form action={save} className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <h2 className="h2">Verkoper op de factuur</h2>
          <div className="fgrid">
            <label className="field" style={{ gridColumn: "1/-1" }}>Bedrijfsnaam<input name="name" defaultValue={s0.name} required /></label>
            <label className="field" style={{ gridColumn: "1/-1" }}>Straat en nummer<input name="street" defaultValue={s0.street} /></label>
            <label className="field">Postcode<input name="postcode" defaultValue={s0.postcode} /></label>
            <label className="field">Gemeente<input name="city" defaultValue={s0.city} /></label>
            <label className="field">Btw-nummer<input name="vat" defaultValue={s0.vat} placeholder="BE 0123.456.789" /></label>
            <label className="field">E-mail<input name="email" type="email" defaultValue={s0.email} /></label>
            <label className="field">IBAN<input name="iban" defaultValue={s0.iban} placeholder="BE00 0000 0000 0000" /></label>
            <label className="field">BIC<input name="bic" defaultValue={s0.bic} /></label>
            <label className="field">Btw-tarief (%)<input name="vat_rate" type="number" defaultValue={s0.vat_rate} /></label>
            <label className="field">Betaaltermijn (dagen)<input name="due_days" type="number" defaultValue={s0.due_days} /></label>
          </div>
          <div><button className="btn btn-primary">Opslaan</button></div>
        </form>
        <form action={savePrices} className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <h2 className="h2">Prijzen (excl. btw)</h2>
          <div className="fgrid">
            {prices?.map((p) => <label key={p.key} className="field">{p.label}<input name={p.key} defaultValue={fromCents(p.cents)} inputMode="decimal" /></label>)}
          </div>
          <p className="muted small" style={{ margin: 0 }}>Nieuwe prijzen gelden voor nieuwe facturen. Nu: {prices?.map((p) => eur(p.cents)).join(" · ")}</p>
          <div><button className="btn btn-primary">Opslaan</button></div>
        </form>
        <form action={saveGids} className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <h2 className="h2">BestelBon-gids</h2>
          <p className="muted small" style={{ margin: 0 }}>Klanten zoeken op postcode naar zaken. Zolang de gids niet publiek is, zie alleen jij hem (ingelogd) en staat hij niet in Google. {inGids ?? 0} zaak/zaken doen mee.</p>
          <label className="check big"><input type="checkbox" name="gids_public" defaultChecked={!!ps?.gids_public} /> Gids publiek op bestelbon.eu/bestellen</label>
          <p className="small" style={{ margin: 0 }}><a href="/bestellen" target="_blank" rel="noopener">Gids bekijken</a></p>
          <div><button className="btn btn-primary">Opslaan</button></div>
        </form>
      </div>
    </>
  );
}
