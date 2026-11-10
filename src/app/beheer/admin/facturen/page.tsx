import Link from "next/link";
import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { adminOnly } from "@/lib/admin";
import { eur } from "@/lib/money";
import { PEPPOL, periodLabel, shortDate, shownStatus, STATUS } from "@/lib/invoice";
import { createDueInvoices } from "@/lib/subscription";
import { unblockIfPaid } from "@/lib/billing";
import { after } from "next/server";
import { octopusEnabled, syncInvoiceToOctopus } from "@/lib/octopus";

export const dynamic = "force-dynamic";
export const metadata = { title: "Facturen" };

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function monthly() {
  "use server";
  await adminOnly();
  const n = await createDueInvoices();
  redirect(`/beheer/admin/facturen?gemaakt=${n}`);
}

const OCTO: Record<string, string> = { bezig: "bezig…", aangemaakt: "aangemaakt, nog niet verstuurd", peppol_bezig: "via Peppol onderweg", peppol_ok: "afgeleverd via Peppol", email_ok: "per e-mail verstuurd", test_niet_verstuurd: "testmodus (niet verstuurd)", fout: "fout", nul_bedrag: "€ 0, overgeslagen" };

async function octoRetry(f: FormData) {
  "use server";
  await adminOnly();
  await syncInvoiceToOctopus(s(f, "id"), { force: true });
  redirect("/beheer/admin/facturen");
}

async function setStatus(f: FormData) {
  "use server";
  const db = await adminOnly();
  const st = s(f, "status");
  const patch: Record<string, unknown> =
    st === "betaald" ? { status: "betaald", paid_at: new Date().toISOString(), payment_method: s(f, "method") || "overschrijving" }
    : st === "open" ? { status: "open", paid_at: null, payment_method: null }
    : st === "gecrediteerd" ? { status: "gecrediteerd" }
    : {};
  if (s(f, "peppol") in PEPPOL) patch.peppol_status = s(f, "peppol");
  if (Object.keys(patch).length) await db.from("invoices").update(patch).eq("id", s(f, "id"));
  if (st === "betaald") {
    const { data: inv } = await db.from("invoices").select("company_id").eq("id", s(f, "id")).maybeSingle();
    if (inv) await unblockIfPaid(inv.company_id);
    after(() => syncInvoiceToOctopus(s(f, "id")).then(() => undefined));
  }
  redirect(`/beheer/admin/facturen?${new URLSearchParams({ status: s(f, "f_status"), maand: s(f, "f_maand") })}`);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; maand?: string; gemaakt?: string; fout?: string }> }) {
  const sp = await searchParams;
  const db = await adminOnly();
  let q = db.from("invoices").select("id, number, issued_on, due_on, status, total_cents, vat_cents, peppol_status, period, payment_method, octopus_status, octopus_doc, octopus_error, companies(id, legal_name)").order("seq", { ascending: false }).limit(500);
  if (sp.maand && /^\d{4}-\d{2}$/.test(sp.maand)) q = q.gte("issued_on", `${sp.maand}-01`).lt("issued_on", new Date(Date.UTC(Number(sp.maand.slice(0, 4)), Number(sp.maand.slice(5, 7)), 1)).toISOString().slice(0, 10));
  const { data: all } = await q;
  const list = (all ?? []).filter((i) => !sp.status || shownStatus(i) === sp.status);
  const sum = (st: string) => list.filter((i) => shownStatus(i) === st).reduce((a, i) => a + i.total_cents, 0);
  return (
    <>
      <AdminNav active="facturen" />
      <h1 className="ph">Facturen <Link href="/beheer/admin/octopus" className="pill" style={{ fontSize: 13, verticalAlign: "middle" }}>Octopus{octopusEnabled() ? "" : " (uit)"}</Link></h1>
      {sp.gemaakt && <div className="okmsg">{sp.gemaakt === "0" ? "Geen nieuwe betaalverzoeken: alle lopende periodes zijn al gefactureerd." : `${sp.gemaakt} betaalverzoeken gemaakt en gemaild.`}</div>}
      {sp.fout && <div className="alert">Kies een geldige maand.</div>}
      <div className="sgrid">
        <form action={monthly} className="panel" style={{ display: "grid", gap: 10 }}>
          <h2 className="h2">Abonnementen</h2>
          <p className="muted small" style={{ margin: 0 }}>Elke dag om 8 uur maakt het systeem vanzelf een betaalverzoek voor elke zaak waarvan een nieuwe periode begint, op de dag van de startdatum (start op de 20e = elke 20e; jaarlijks = elk jaar op die dag, met 10% korting). De zaak krijgt het meteen per e-mail: met betaalknop, of met de aankondiging van de domiciliëring. Wat al gefactureerd is, wordt overgeslagen.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary">Nu controleren en aanmaken</button>
          </div>
        </form>
        <div className="kpis" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
          <div className="kpi"><span>Open</span><b className="kt">{eur(sum("open"))}</b></div>
          <div className="kpi"><span>Vervallen</span><b className="kt">{eur(sum("vervallen"))}</b></div>
          <div className="kpi"><span>Betaald</span><b className="kt">{eur(sum("betaald"))}</b></div>
        </div>
      </div>
      <section className="panel" style={{ display: "grid", gap: 12 }}>
        <form className="filters" method="get">
          <input type="month" name="maand" defaultValue={sp.maand} aria-label="Maand" />
          <select name="status" defaultValue={sp.status ?? ""} aria-label="Status"><option value="">Alle statussen</option>{Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
          <button className="btn">Filter</button>
          <a className="btn" href={`/beheer/admin/facturen/export?${new URLSearchParams({ maand: sp.maand ?? "" })}`}>Export voor boekhouder (CSV)</a>
        </form>
        <div className="tblwrap"><table className="tbl">
          <thead><tr><th>Nummer</th><th>Klant</th><th>Datum</th><th>Bedrag</th><th>Status</th><th>Actie</th></tr></thead>
          <tbody>{list.map((i) => {
            const st = shownStatus(i);
            const co = i.companies as unknown as { id: string; legal_name: string } | null;
            return (
              <tr key={i.id}>
                <td><Link href={`/beheer/factuur/${i.id}`}>{i.number}</Link></td>
                <td><Link href={`/beheer/admin/bedrijf/${co?.id}`}>{co?.legal_name}</Link><div className="muted small">{i.period ? periodLabel(i.period) : "eenmalig"}</div></td>
                <td>{shortDate(i.issued_on)}<div className="muted small">verv. {shortDate(i.due_on)}</div></td>
                <td>{eur(i.total_cents)}</td>
                <td><span className={`pill ${STATUS[st]?.[1]}`}>{STATUS[st]?.[0]}</span><div className="muted small">{PEPPOL[i.peppol_status] ?? i.peppol_status}</div>
                  {octopusEnabled() && i.status === "betaald" && <div className="small" title={i.octopus_error ?? ""} style={{ color: i.octopus_status === "fout" ? "var(--ketchup)" : undefined }}>Octopus: {OCTO[i.octopus_status ?? ""] ?? "wacht"}{i.octopus_doc ? ` · ${i.octopus_doc}` : ""}
                    {(!i.octopus_status || ["fout", "aangemaakt", "test_niet_verstuurd"].includes(i.octopus_status)) && <form action={octoRetry} style={{ display: "inline" }}><input type="hidden" name="id" value={i.id} /> <button className="s-link small" style={{ padding: 0 }}>opnieuw</button></form>}
                    {i.octopus_error && <div className="muted">{i.octopus_error.slice(0, 120)}</div>}</div>}</td>
                <td>
                  <form action={setStatus} className="rowform">
                    <input type="hidden" name="id" value={i.id} /><input type="hidden" name="f_status" value={sp.status ?? ""} /><input type="hidden" name="f_maand" value={sp.maand ?? ""} />
                    <select name="status" defaultValue="" aria-label="Status wijzigen">
                      <option value="">Status…</option><option value="betaald">Betaald</option><option value="open">Open</option><option value="gecrediteerd">Gecrediteerd</option>
                    </select>
                    <select name="method" defaultValue="overschrijving" aria-label="Betaalwijze"><option value="overschrijving">Overschrijving</option><option value="domiciliëring">Domiciliëring</option><option value="cash">Cash</option></select>
                    <select name="peppol" defaultValue="" aria-label="Peppol"><option value="">Peppol…</option>{Object.entries(PEPPOL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    <button className="btn">OK</button>
                  </form>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
        {!list.length && <p className="muted">Geen facturen.</p>}</div>
      </section>
    </>
  );
}
