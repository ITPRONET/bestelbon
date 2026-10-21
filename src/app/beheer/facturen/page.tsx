import Link from "next/link";
import { redirect } from "next/navigation";
import PanelNav from "@/components/PanelNav";
import { panel, longDate } from "@/lib/panel";
import { userDb } from "@/lib/supabase-server";
import { eur } from "@/lib/money";
import { normVat } from "@/lib/vat";
import { seller, shownStatus, shortDate, STATUS } from "@/lib/invoice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Facturen & gegevens" };

const s = (f: FormData, k: string, n = 100) => String(f.get(k) ?? "").trim().slice(0, n);

async function saveCompany(f: FormData) {
  "use server";
  const db = await userDb();
  const zaak = s(f, "zaak");
  const vat = normVat(s(f, "vat_number"));
  if (!vat.ok) redirect(`/beheer/facturen?zaak=${zaak}&fout=btw`);
  const email = s(f, "email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(`/beheer/facturen?zaak=${zaak}&fout=mail`);
  const { error } = await db.from("companies").update({
    legal_name: s(f, "legal_name"), vat_number: vat.display, street: s(f, "street") || null, postcode: s(f, "postcode", 10) || null,
    city: s(f, "city", 60) || null, contact_name: s(f, "contact_name", 80) || null, email, phone: s(f, "phone", 30) || null,
  }).eq("id", s(f, "cid"));
  redirect(`/beheer/facturen?zaak=${zaak}&${error ? "fout=opslaan" : "ok=1"}`);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ zaak?: string; ok?: string; fout?: string }> }) {
  const sp = await searchParams;
  const { db, restaurants, current } = await panel(sp.zaak);
  if (!current) return null;
  const [{ data: co }, { data: invoices }, { data: prices }, sel] = await Promise.all([
    db.from("companies").select("id, legal_name, vat_number, street, postcode, city, contact_name, email, phone, plan, status, started_on").eq("id", current.company_id).single(),
    db.from("invoices").select("id, number, issued_on, due_on, status, total_cents, ogm").eq("company_id", current.company_id).order("seq", { ascending: false }),
    db.from("prices").select("key, cents"),
    seller(),
  ]);
  if (!co) return null;
  const monthly = prices?.find((p) => p.key === co.plan)?.cents ?? 0;
  const unpaid = (invoices ?? []).filter((i) => ["open", "vervallen"].includes(shownStatus(i)));
  const errors: Record<string, string> = { btw: "Dit btw-nummer klopt niet. Controleer het nummer.", mail: "Vul een geldig e-mailadres in.", opslaan: "Opslaan is niet gelukt. Probeer opnieuw." };
  return (
    <>
      <PanelNav active="facturen" restaurants={restaurants} current={current} />
      <h1 className="ph">Facturen &amp; gegevens</h1>
      {sp.ok && <div className="okmsg">Bedrijfsgegevens opgeslagen.</div>}
      {sp.fout && <div className="alert">{errors[sp.fout] ?? "Er ging iets mis."}</div>}
      {unpaid.length > 0 && (
        <div className="alert">
          {unpaid.length === 1 ? "1 factuur staat open" : `${unpaid.length} facturen staan open`}: {eur(unpaid.reduce((t, i) => t + i.total_cents, 0))}.
          Betaal op {sel.iban || "ons rekeningnummer"} met de gestructureerde mededeling op de factuur.
        </div>
      )}
      <div className="kpis">
        <div className="kpi"><span>Pakket</span><b className="kt">{co.plan === "pro" ? "Pro" : "Standaard"}</b><small>{eur(monthly)} per maand excl. btw</small></div>
        <div className="kpi"><span>Status</span><b className="kt">{{ installatie: "Installatie", actief: "Actief", achterstallig: "Achterstallig", opgezegd: "Opgezegd" }[co.status as string]}</b><small>sinds {longDate(co.started_on)}</small></div>
        <div className="kpi"><span>Facturen</span><b>{invoices?.length ?? 0}</b><small>{unpaid.length} open</small></div>
        <div className="kpi"><span>Pakket wijzigen?</span><b className="kt" style={{ fontSize: 15 }}>info@bestelbon.eu</b><small>wij passen het aan</small></div>
      </div>
      <div className="sgrid">
        <section className="panel">
          <h2 className="h2">Facturen</h2>
          {!invoices?.length ? <p className="muted" style={{ margin: 0 }}>Nog geen facturen.</p> : (
            <table className="tbl">
              <thead><tr><th>Nummer</th><th>Datum</th><th>Bedrag</th><th>Status</th></tr></thead>
              <tbody>{invoices.map((i) => {
                const st = shownStatus(i);
                return (
                  <tr key={i.id}>
                    <td><Link href={`/beheer/factuur/${i.id}`}>{i.number}</Link></td>
                    <td>{shortDate(i.issued_on)}</td>
                    <td>{eur(i.total_cents)}</td>
                    <td><span className={`pill ${STATUS[st]?.[1] ?? ""}`}>{STATUS[st]?.[0] ?? st}</span></td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </section>
        <form action={saveCompany} className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <input type="hidden" name="cid" value={co.id} /><input type="hidden" name="zaak" value={current.slug} />
          <h2 className="h2">Bedrijfsgegevens voor de factuur</h2>
          <div className="fgrid">
            <label className="field" style={{ gridColumn: "1/-1" }}>Bedrijfsnaam<input name="legal_name" defaultValue={co.legal_name} required /></label>
            <label className="field">Btw-nummer<input name="vat_number" defaultValue={co.vat_number} required /></label>
            <label className="field">Contactpersoon<input name="contact_name" defaultValue={co.contact_name ?? ""} /></label>
            <label className="field" style={{ gridColumn: "1/-1" }}>Straat en nummer<input name="street" defaultValue={co.street ?? ""} /></label>
            <label className="field">Postcode<input name="postcode" defaultValue={co.postcode ?? ""} /></label>
            <label className="field">Gemeente<input name="city" defaultValue={co.city ?? ""} /></label>
            <label className="field">E-mail voor facturen<input name="email" type="email" defaultValue={co.email} required /></label>
            <label className="field">Telefoon<input name="phone" defaultValue={co.phone ?? ""} /></label>
          </div>
          <p className="muted small" style={{ margin: 0 }}>Facturen gaan via Peppol naar je boekhoudpakket of per e-mail naar dit adres.</p>
          <div><button className="btn btn-primary">Opslaan</button></div>
        </form>
      </div>
    </>
  );
}
