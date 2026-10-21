import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { adminOnly, CO_STATUS, PLAN } from "@/lib/admin";
import { eur } from "@/lib/money";
import { shownStatus } from "@/lib/invoice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Beheerder" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const db = await adminOnly();
  const [{ data: cos }, { data: invs }, { data: prices }, { data: inst }, { data: printers }] = await Promise.all([
    db.from("companies").select("id, legal_name, vat_number, city, email, plan, status, started_on, restaurants(id, name, slug)").order("legal_name"),
    db.from("invoices").select("company_id, status, due_on, total_cents"),
    db.from("prices").select("key, cents"),
    db.from("installations").select("status"),
    db.from("printers").select("restaurant_id, last_seen_at"),
  ]);
  const price = (k: string) => prices?.find((p) => p.key === k)?.cents ?? 0;
  const live = (cos ?? []).filter((c) => c.status === "actief" || c.status === "achterstallig");
  const mrr = live.reduce((t, c) => t + price(c.plan), 0);
  const open = (invs ?? []).filter((i) => ["open", "vervallen"].includes(shownStatus(i)));
  const overdue = open.filter((i) => shownStatus(i) === "vervallen");
  const online = new Set((printers ?? []).filter((p) => p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < 120000).map((p) => p.restaurant_id));
  const q = (sp.q ?? "").toLowerCase();
  const list = (cos ?? []).filter((c) => (!sp.status || c.status === sp.status) && (!q || `${c.legal_name} ${c.vat_number} ${c.city} ${c.email}`.toLowerCase().includes(q)));
  return (
    <>
      <AdminNav active="" />
      <h1 className="ph">Overzicht</h1>
      <div className="kpis">
        <div className="kpi"><span>Actieve abonnementen</span><b>{live.length}</b><small>{live.filter((c) => c.plan === "pro").length} Pro · {live.filter((c) => c.plan !== "pro").length} Standaard</small></div>
        <div className="kpi"><span>Maandomzet (excl. btw)</span><b>{eur(mrr)}</b><small>{eur(mrr * 12)} per jaar</small></div>
        <div className="kpi"><span>Openstaand</span><b>{eur(open.reduce((t, i) => t + i.total_cents, 0))}</b><small>{overdue.length} vervallen</small></div>
        <div className="kpi"><span>Installaties</span><b>{(inst ?? []).filter((i) => i.status !== "geinstalleerd").length}</b><small>nog te doen</small></div>
      </div>
      <section className="panel" style={{ display: "grid", gap: 12 }}>
        <form className="filters" method="get">
          <input name="q" defaultValue={sp.q} placeholder="Zoek op naam, btw, gemeente of e-mail" aria-label="Zoeken" />
          <select name="status" defaultValue={sp.status ?? ""} aria-label="Status">
            <option value="">Alle statussen</option>
            {Object.entries(CO_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="btn">Filter</button>
          <Link className="btn btn-primary" href="/beheer/admin/nieuw">+ Nieuwe klant</Link>
        </form>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Bedrijf</th><th>Zaken</th><th>Pakket</th><th>Status</th><th>Openstaand</th></tr></thead>
            <tbody>{list.map((c) => {
              const due = open.filter((i) => i.company_id === c.id).reduce((t, i) => t + i.total_cents, 0);
              const rs = (c.restaurants ?? []) as { id: string; name: string; slug: string }[];
              return (
                <tr key={c.id}>
                  <td><Link href={`/beheer/admin/bedrijf/${c.id}`}><b>{c.legal_name}</b></Link><div className="muted small">{c.vat_number} · {c.city ?? "—"}</div></td>
                  <td>{rs.map((r) => <div key={r.id} className="small"><span className={`dot ${online.has(r.id) ? "on" : ""}`} title={online.has(r.id) ? "Printer online" : "Geen printer online"} /> <Link href={`/beheer?zaak=${r.slug}`}>{r.name}</Link></div>)}</td>
                  <td>{PLAN[c.plan]}</td>
                  <td><span className={`pill ${CO_STATUS[c.status]?.[1]}`}>{CO_STATUS[c.status]?.[0]}</span></td>
                  <td>{due ? eur(due) : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
          {!list.length && <p className="muted">Geen bedrijven gevonden.</p>}
        </div>
      </section>
    </>
  );
}
