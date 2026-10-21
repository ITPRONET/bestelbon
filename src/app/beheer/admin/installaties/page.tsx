import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { adminOnly, INST_STATUS } from "@/lib/admin";
import { shortDate } from "@/lib/invoice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Installaties" };

export default async function Page() {
  const db = await adminOnly();
  const { data } = await db.from("installations").select("id, status, planned_on, done_on, printers_cable, printers_wifi, notes, companies(id, legal_name, contact_name, phone, street, postcode, city), restaurants(name)").order("planned_on", { ascending: true, nullsFirst: true });
  const groups = ["te_plannen", "gepland", "geinstalleerd"] as const;
  return (
    <>
      <AdminNav active="installaties" />
      <h1 className="ph">Installaties</h1>
      {groups.map((g) => {
        const rows = (data ?? []).filter((i) => i.status === g);
        return (
          <section key={g} className="panel" style={{ display: "grid", gap: 8 }}>
            <h2 className="h2">{INST_STATUS[g][0]} <span className="muted">({rows.length})</span></h2>
            {!rows.length && <p className="muted small" style={{ margin: 0 }}>Niets.</p>}
            {rows.map((i) => {
              const co = i.companies as unknown as { id: string; legal_name: string; contact_name: string | null; phone: string | null; street: string | null; postcode: string | null; city: string | null };
              const r = i.restaurants as unknown as { name: string } | null;
              const addr = [co.street, `${co.postcode ?? ""} ${co.city ?? ""}`.trim()].filter(Boolean).join(", ");
              return (
                <div key={i.id} className="grp" style={{ display: "grid", gap: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/beheer/admin/bedrijf/${co.id}`}><b>{r?.name ?? co.legal_name}</b></Link>
                    <span className="small">{i.planned_on ? shortDate(i.planned_on) : "geen datum"}{i.done_on ? ` · klaar ${shortDate(i.done_on)}` : ""}</span>
                  </div>
                  <div className="small muted">{i.printers_cable}× kabel · {i.printers_wifi}× wifi · {co.contact_name ?? ""} {co.phone ?? ""}</div>
                  {addr && <a className="small" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`} target="_blank" rel="noopener">{addr}</a>}
                  {i.notes && <div className="small">{i.notes}</div>}
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
