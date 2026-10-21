import Link from "next/link";
import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { adminOnly, PLAN } from "@/lib/admin";
import { eur } from "@/lib/money";
import { today } from "@/lib/panel";
import { PEPPOL, periodLabel, shortDate, shownStatus, STATUS } from "@/lib/invoice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Facturen" };

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function monthly(f: FormData) {
  "use server";
  const db = await adminOnly();
  const period = s(f, "period");
  if (!/^\d{4}-\d{2}$/.test(period)) redirect("/beheer/admin/facturen?fout=maand");
  const first = `${period}-01`;
  const last = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [{ data: cos }, { data: done }, { data: prices }] = await Promise.all([
    db.from("companies").select("id, plan, started_on, ended_on").in("status", ["actief", "achterstallig"]).lte("started_on", last),
    db.from("invoices").select("company_id").eq("period", period),
    db.from("prices").select("key, cents"),
  ]);
  const have = new Set((done ?? []).map((d) => d.company_id));
  let n = 0;
  for (const c of cos ?? []) {
    if (have.has(c.id) || (c.ended_on && c.ended_on < first)) continue;
    const cents = prices?.find((p) => p.key === c.plan)?.cents ?? 0;
    const { error } = await db.rpc("create_invoice", { p_company: c.id, p_period: period, p_lines: [{ description: `Abonnement BestelBon ${PLAN[c.plan]} – ${periodLabel(period)}`, qty: 1, unit_cents: cents }] });
    if (!error) n++;
  }
  redirect(`/beheer/admin/facturen?gemaakt=${n}&maand=${period}`);
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
  redirect(`/beheer/admin/facturen?${new URLSearchParams({ status: s(f, "f_status"), maand: s(f, "f_maand") })}`);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; maand?: string; gemaakt?: string; fout?: string }> }) {
  const sp = await searchParams;
  const db = await adminOnly();
  let q = db.from("invoices").select("id, number, issued_on, due_on, status, total_cents, vat_cents, peppol_status, period, payment_method, companies(id, legal_name)").order("seq", { ascending: false }).limit(500);
  if (sp.maand && /^\d{4}-\d{2}$/.test(sp.maand)) q = q.gte("issued_on", `${sp.maand}-01`).lt("issued_on", new Date(Date.UTC(Number(sp.maand.slice(0, 4)), Number(sp.maand.slice(5, 7)), 1)).toISOString().slice(0, 10));
  const { data: all } = await q;
  const list = (all ?? []).filter((i) => !sp.status || shownStatus(i) === sp.status);
  const t = today();
  const next = new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)), 1)).toISOString().slice(0, 7);
  const sum = (st: string) => list.filter((i) => shownStatus(i) === st).reduce((a, i) => a + i.total_cents, 0);
  return (
    <>
      <AdminNav active="facturen" />
      <h1 className="ph">Facturen</h1>
      {sp.gemaakt && <div className="okmsg">{sp.gemaakt === "0" ? "Geen nieuwe maandfacturen: alles voor deze maand is al gefactureerd." : `${sp.gemaakt} maandfacturen gemaakt.`}</div>}
      {sp.fout && <div className="alert">Kies een geldige maand.</div>}
      <div className="sgrid">
        <form action={monthly} className="panel" style={{ display: "grid", gap: 10 }}>
          <h2 className="h2">Maandfacturen abonnementen</h2>
          <p className="muted small" style={{ margin: 0 }}>Maakt één factuur per actief abonnement voor de gekozen maand. Wat al gefactureerd is, wordt overgeslagen.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="month" name="period" defaultValue={next} className="inp" aria-label="Maand" />
            <button className="btn btn-primary">Maandfacturen maken</button>
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
                <td><span className={`pill ${STATUS[st]?.[1]}`}>{STATUS[st]?.[0]}</span><div className="muted small">{PEPPOL[i.peppol_status] ?? i.peppol_status}</div></td>
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
