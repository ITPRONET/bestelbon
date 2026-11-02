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
  const [{ data: cos }, { data: invs }, { data: prices }, { data: inst }, { data: printers }, { count: newReq }] = await Promise.all([
    db.from("companies").select("id, legal_name, vat_number, city, postcode, email, phone, contact_name, plan, status, started_on, blocked_at, blocked_reason, restaurants(id, name, slug)").order("legal_name"),
    db.from("invoices").select("company_id, status, due_on, total_cents"),
    db.from("prices").select("key, cents"),
    db.from("installations").select("status"),
    db.from("printers").select("restaurant_id, last_seen_at"),
    db.from("signups").select("id", { count: "exact", head: true }).eq("status", "nieuw"),
  ]);
  const price = (k: string) => prices?.find((p) => p.key === k)?.cents ?? 0;
  const live = (cos ?? []).filter((c) => c.status === "actief" || c.status === "achterstallig");
  const mrr = live.reduce((t, c) => t + price(c.plan), 0);
  const open = (invs ?? []).filter((i) => ["open", "vervallen"].includes(shownStatus(i)));
  const overdue = open.filter((i) => shownStatus(i) === "vervallen");
  const online = new Set((printers ?? []).filter((p) => p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < 120000).map((p) => p.restaurant_id));
  const q = (sp.q ?? "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const blocked = (cos ?? []).filter((c) => c.blocked_at);
  const list = (cos ?? []).filter((c) => {
    if (sp.status === "geblokkeerd" ? !c.blocked_at : sp.status && c.status !== sp.status) return false;
    if (!q) return true;
    const rs = (c.restaurants ?? []) as { name: string; slug: string }[];
    const hay = `${c.legal_name} ${c.vat_number} ${c.city ?? ""} ${c.postcode ?? ""} ${c.email} ${c.contact_name ?? ""} ${rs.map((r) => `${r.name} ${r.slug}`).join(" ")}`.toLowerCase();
    // Btw- en telefoonnummers ook zonder punten/spaties vinden.
    return hay.includes(q) || (digits.length >= 4 && `${c.vat_number} ${c.phone ?? ""}`.replace(/\D/g, "").includes(digits));
  });
  return (
    <>
      <AdminNav active="" q={sp.q} />
      <h1 className="ph">Overzicht</h1>
      {!!newReq && <Link href="/beheer/admin/aanvragen" className="alert" style={{ textDecoration: "none" }}>{newReq === 1 ? "1 nieuwe aanmelding" : `${newReq} nieuwe aanmeldingen`} wacht op je. Bekijk →</Link>}
      <div className="kpis">
        <div className="kpi"><span>Actieve abonnementen</span><b>{live.length}</b><small>{live.filter((c) => c.plan === "pro").length} Pro · {live.filter((c) => c.plan !== "pro").length} Standaard</small></div>
        <div className="kpi"><span>Maandomzet (excl. btw)</span><b>{eur(mrr)}</b><small>{eur(mrr * 12)} per jaar</small></div>
        <div className="kpi"><span>Openstaand</span><b>{eur(open.reduce((t, i) => t + i.total_cents, 0))}</b><small>{overdue.length} vervallen</small></div>
        <Link href="/beheer/admin?status=geblokkeerd" className="kpi" style={{ textDecoration: "none", color: "inherit" }}><span>Geblokkeerd</span><b style={blocked.length ? { color: "#c0262d" } : undefined}>{blocked.length}</b><small>{blocked.length ? "bekijk →" : "niemand"}</small></Link>
        <div className="kpi"><span>Installaties</span><b>{(inst ?? []).filter((i) => i.status !== "geinstalleerd").length}</b><small>nog te doen</small></div>
      </div>
      <section className="panel" style={{ display: "grid", gap: 12 }}>
        <form className="filters" method="get">
          <input name="q" defaultValue={sp.q} placeholder="Zoek op naam, zaak, btw, gemeente, e-mail of telefoon" aria-label="Zoeken" />
          <select name="status" defaultValue={sp.status ?? ""} aria-label="Status">
            <option value="">Alle statussen</option>
            {Object.entries(CO_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
            <option value="geblokkeerd">Geblokkeerd</option>
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
                <tr key={c.id} className={c.blocked_at ? "row-blocked" : undefined}>
                  <td><Link href={`/beheer/admin/bedrijf/${c.id}`}><b>{c.legal_name}</b></Link><div className="muted small">{c.vat_number} · {c.city ?? "—"}</div></td>
                  <td>{rs.map((r) => <div key={r.id} className="small"><span className={`dot ${online.has(r.id) ? "on" : ""}`} title={online.has(r.id) ? "Printer online" : "Geen printer online"} /> <Link href={`/beheer?zaak=${r.slug}`}>{r.name}</Link></div>)}</td>
                  <td>{PLAN[c.plan]}</td>
                  <td><span className={`pill ${CO_STATUS[c.status]?.[1]}`}>{CO_STATUS[c.status]?.[0]}</span>{c.blocked_at && <><br /><span className="pill bad" title={`Geblokkeerd sinds ${c.blocked_at.slice(0, 10)}`} style={{ marginTop: 4 }}>Geblokkeerd</span></>}</td>
                  <td>{due ? eur(due) : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
          {!list.length && <p className="muted">Geen bedrijven gevonden{q ? <> voor “{sp.q}”</> : ""}.</p>}
        </div>
      </section>
    </>
  );
}
