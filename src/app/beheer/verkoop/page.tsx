import Link from "next/link";
import PanelNav from "@/components/PanelNav";
import { panel, today, addDays, longDate } from "@/lib/panel";
import { eur } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verkoop" };

const MON = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
type P = "dag" | "week" | "maand" | "alles";

function range(p: P, ref: string, start: string) {
  const d = new Date(ref + "T12:00:00Z");
  if (p === "dag") return { d1: ref, d2: ref, unit: "hour", label: longDate(ref) };
  if (p === "week") {
    const mon = addDays(ref, -((d.getUTCDay() + 6) % 7)), sun = addDays(mon, 6);
    return { d1: mon, d2: sun, unit: "day", label: `Week van ${longDate(mon)}` };
  }
  if (p === "maand") {
    const first = ref.slice(0, 8) + "01";
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    return { d1: first, d2: last, unit: "day", label: `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  }
  return { d1: start, d2: today(), unit: "month", label: `Sinds de start (${longDate(start)})` };
}

function buckets(unit: string, d1: string, d2: string) {
  const out: { key: string; label: string }[] = [];
  if (unit === "hour") for (let h = 10; h <= 23; h++) out.push({ key: String(h).padStart(2, "0"), label: `${h}u` });
  else if (unit === "day") for (let x = d1; x <= d2; x = addDays(x, 1)) out.push({ key: x, label: String(+x.slice(8)) });
  else { let y = +d1.slice(0, 4), m = +d1.slice(5, 7) - 1; while (`${y}-${String(m + 1).padStart(2, "0")}` <= d2.slice(0, 7)) { out.push({ key: `${y}-${String(m + 1).padStart(2, "0")}`, label: MON[m] }); m++; if (m > 11) { m = 0; y++; } } }
  return out;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ zaak?: string; periode?: string; datum?: string }> }) {
  const sp = await searchParams;
  const { db, restaurants, current } = await panel(sp.zaak);
  if (!current) return null;
  const p: P = (["dag", "week", "maand", "alles"] as const).find((x) => x === sp.periode) ?? "maand";
  const { data: rinfo } = await db.from("restaurants").select("created_at").eq("id", current.id).single();
  const start = (rinfo?.created_at ?? new Date().toISOString()).slice(0, 10);
  const ref = sp.datum && /^\d{4}-\d{2}-\d{2}$/.test(sp.datum) && sp.datum <= today() ? sp.datum : today();
  const R = range(p, ref, start);
  const args = { rid: current.id, d1: R.d1, d2: R.d2 };
  const [k, items, opts, bs] = await Promise.all([
    db.rpc("stats_kpis", args).single(),
    db.rpc("stats_items", args),
    db.rpc("stats_options", args),
    db.rpc("stats_buckets", { ...args, unit: R.unit }),
  ]);
  const kp = (k.data ?? { orders: 0, revenue_cents: 0, delivery: 0, online: 0 }) as { orders: number; revenue_cents: number; delivery: number; online: number };
  const it = (items.data ?? []) as { item_name: string; qty: number; revenue_cents: number }[];
  const op = (opts.data ?? []) as { option_name: string; qty: number }[];
  const bm = new Map(((bs.data ?? []) as { bucket: string; orders: number }[]).map((b) => [b.bucket, Number(b.orders)]));
  const bars = buckets(R.unit, R.d1, R.d2).map((b) => ({ ...b, n: bm.get(b.key) ?? 0 }));
  const maxB = Math.max(1, ...bars.map((b) => b.n)), maxQ = Math.max(1, ...it.map((i) => Number(i.qty))), maxO = Math.max(1, ...op.map((o) => Number(o.qty)));
  const pct = (a: number) => (kp.orders ? Math.round((a / kp.orders) * 100) + "%" : "–");
  const link = (np: P) => `/beheer/verkoop?zaak=${current.slug}&periode=${np}&datum=${ref}`;

  return (
    <>
      <PanelNav active="verkoop" restaurants={restaurants} current={current} />
      <h1 className="ph">Verkoop</h1>
      <div className="panel daybar">
        <div className="seg2">{(["dag", "week", "maand", "alles"] as const).map((x) => <Link key={x} href={link(x)} aria-current={p === x ? "page" : undefined}>{x === "alles" ? "Sinds start" : x[0].toUpperCase() + x.slice(1)}</Link>)}</div>
        {p !== "alles" && (
          <form method="get" className="dayform">
            <input type="hidden" name="zaak" value={current.slug} /><input type="hidden" name="periode" value={p} />
            <label className="field">Datum<input type="date" name="datum" defaultValue={ref} max={today()} /></label>
            <button className="btn">Toon</button>
          </form>
        )}
        <div className="daysum"><b className="cap">{R.label}</b></div>
      </div>
      {kp.orders ? (
        <>
          <div className="kpis">
            <div className="kpi"><span>Omzet</span><b className="num">{eur(Number(kp.revenue_cents))}</b><small>incl. leverkosten</small></div>
            <div className="kpi"><span>Bestellingen</span><b className="num">{kp.orders}</b><small>{pct(Number(kp.delivery))} levering</small></div>
            <div className="kpi"><span>Gemiddeld</span><b className="num">{eur(Math.round(Number(kp.revenue_cents) / kp.orders))}</b><small>{pct(Number(kp.online))} online betaald</small></div>
            <div className="kpi"><span>Topproduct</span><b className="kt">{it[0]?.item_name ?? "–"}</b><small>{it[0] ? `${it[0].qty} stuks` : ""}</small></div>
          </div>
          <div className="sgrid">
            <section className="panel">
              <h2 className="h2">Bestsellers</h2>
              <div className="rank">{it.map((i, n) => (
                <div className="rk" key={i.item_name}><span className="muted num">{n + 1}</span>
                  <div className="rk-m"><div className="rk-top"><span>{i.item_name}</span><b className="num">{i.qty} st.</b></div><div className="rk-bar"><i style={{ width: `${(Number(i.qty) / maxQ) * 100}%` }} /></div></div>
                  <span className="num muted" style={{ textAlign: "right" }}>{eur(Number(i.revenue_cents))}</span></div>
              ))}</div>
            </section>
            <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
              <section className="panel">
                <h2 className="h2">Bestellingen per {R.unit === "hour" ? "uur" : R.unit === "day" ? "dag" : "maand"}</h2>
                <div className="chart-wrap"><div className="chart" style={{ "--n": bars.length } as React.CSSProperties}>
                  {bars.map((b) => <div className="col" key={b.key} title={`${b.label}: ${b.n}`}><span className="cv">{bars.length <= 16 && b.n ? b.n : ""}</span><i style={{ height: `${(b.n / maxB) * 100}%` }} className={b.n === maxB ? "top" : ""} /></div>)}
                </div><div className="chart-x" style={{ "--n": bars.length } as React.CSSProperties}>{bars.map((b, i) => <span key={b.key}>{bars.length > 16 && i % 3 ? "" : b.label}</span>)}</div></div>
              </section>
              <section className="panel">
                <h2 className="h2">Populairste sauzen en extra&apos;s</h2>
                {op.length ? <div className="rank">{op.map((o) => (
                  <div className="rk rk-s" key={o.option_name}><div className="rk-m"><div className="rk-top"><span>{o.option_name}</span><b className="num">{o.qty}×</b></div><div className="rk-bar alt"><i style={{ width: `${(Number(o.qty) / maxO) * 100}%` }} /></div></div></div>
                ))}</div> : <p className="muted">Geen opties gekozen.</p>}
              </section>
            </div>
          </div>
        </>
      ) : <div className="panel muted">Geen bestellingen in deze periode.</div>}
    </>
  );
}
