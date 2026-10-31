import Link from "next/link";
import PanelNav from "@/components/PanelNav";
import { panel, today, addDays, longDate } from "@/lib/panel";
import { eur } from "@/lib/money";
import type { TicketOrder, TicketLine } from "@/lib/ticket";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bestellingen" };

const STATUS: Record<string, [string, string]> = {
  geprint: ["Geprint", "ok"], in_wachtrij: ["Wacht op printer", "wait"], wacht_op_betaling: ["Wacht op betaling", "wait"], geannuleerd: ["Geannuleerd", ""],
};

type Row = TicketOrder & { id: string; status: string; order_lines: TicketLine[] };

export default async function Page({ searchParams }: { searchParams: Promise<{ zaak?: string; dag?: string }> }) {
  const sp = await searchParams;
  const { db, restaurants, current } = await panel(sp.zaak);
  if (!current) return <p>Je account is nog niet gekoppeld aan een zaak. Mail naar info@bestelbon.eu.</p>;
  const t = today(), min = addDays(t, -30);
  const dag = sp.dag && /^\d{4}-\d{2}-\d{2}$/.test(sp.dag) && sp.dag >= min && sp.dag <= t ? sp.dag : t;
  const { data } = await db.from("orders")
    .select("id, status, day_number, created_at, mode, requested_time, payment_method, payment_status, total_cents, delivery_fee_cents, customer_name, customer_phone, address, postcode, city, note, late_print, order_lines ( item_name, options, qty, unit_cents )")
    .eq("restaurant_id", current.id).eq("business_day", dag).order("created_at", { ascending: false });
  const rows = (data ?? []).map((o) => ({ ...o, late: o.late_print })) as unknown as Row[];
  const sum = rows.filter((o) => o.status !== "geannuleerd" && o.status !== "wacht_op_betaling").reduce((s, o) => s + o.total_cents, 0);
  const q = (d: string) => `?zaak=${current.slug}&dag=${d}`;

  return (
    <>
      <PanelNav active="" restaurants={restaurants} current={current} />
      <h1 className="ph">Bestellingen</h1>
      <div className="panel daybar">
        <div className="seg2">
          <Link href={q(t)} aria-current={dag === t ? "page" : undefined}>Vandaag</Link>
          <Link href={q(addDays(t, -1))} aria-current={dag === addDays(t, -1) ? "page" : undefined}>Gisteren</Link>
        </div>
        <form method="get" className="dayform">
          <input type="hidden" name="zaak" value={current.slug} />
          <label className="field">Andere dag<input type="date" name="dag" defaultValue={dag} min={min} max={t} /></label>
          <button className="btn">Toon</button>
        </form>
        <div className="daysum"><span className="muted cap">{longDate(dag)}</span><span><b className="num">{rows.length}</b> bestellingen · <b className="num">{eur(sum)}</b> · {rows.filter((o) => o.mode === "levering").length} levering</span></div>
        {rows.length > 0 && <Link className="btn btn-primary" href={`/beheer/bonnen${q(dag)}`}>Alle bonnen van deze dag</Link>}
      </div>
      <p className="muted small">Bonnen blijven 30 dagen beschikbaar. Verkoopcijfers blijven bewaard sinds de start.</p>
      <div className="olist">
        {rows.map((o) => (
          <details className="oitem" key={o.id}>
            <summary className="orow">
              <b className="onr">#{o.day_number}</b>
              <span className="num muted">{new Date(o.created_at).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })}</span>
              <span className="oname">{o.customer_name ?? "–"}</span>
              <span className="pill">{o.mode}</span>
              <span className={`pill ${o.payment_status === "betaald" ? "ok" : "wait"}`}>{o.payment_status === "betaald" ? "Betaald" : "Te betalen"}</span>
              <span className={`pill ${STATUS[o.status]?.[1] ?? ""}`}>{STATUS[o.status]?.[0] ?? o.status}</span>
              <b className="num otot">{eur(o.total_cents)}</b>
            </summary>
            <div className="odetail">
              <div className="small">
                <p>{o.customer_name} · {o.customer_phone}</p>
                {o.mode === "levering" && <p>{o.address}, {o.postcode} {o.city}</p>}
                <p className="muted">{o.requested_time} · {o.payment_method === "online" ? "online betaald" : "cash of kaart bij " + (o.mode === "levering" ? "levering" : "afhaling")}</p>
              </div>
              <div className="bons">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="bonimg" loading="lazy" src={`/beheer/bon/${o.id}?soort=keuken`} alt={`Keukenbon #${o.day_number}`} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {o.mode === "levering" && <img className="bonimg" loading="lazy" src={`/beheer/bon/${o.id}?soort=bezorging`} alt={`Bezorgbon #${o.day_number}`} />}
              </div>
            </div>
          </details>
        ))}
        {!rows.length && <div className="panel muted">Geen bestellingen op deze dag.</div>}
      </div>
    </>
  );
}
