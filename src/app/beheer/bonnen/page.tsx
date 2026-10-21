import Link from "next/link";
import { panel, today, addDays, longDate } from "@/lib/panel";
import { kitchenTicket, deliveryTicket, type TicketOrder, type TicketLine } from "@/lib/ticket";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bonnen van de dag" };

export default async function Page({ searchParams }: { searchParams: Promise<{ zaak?: string; dag?: string; soort?: string }> }) {
  const sp = await searchParams;
  const { db, current } = await panel(sp.zaak);
  if (!current) return null;
  const t = today(), min = addDays(t, -30);
  const dag = sp.dag && sp.dag >= min && sp.dag <= t ? sp.dag : t;
  const soort = sp.soort === "keuken" || sp.soort === "bezorging" ? sp.soort : "alle";
  const { data } = await db.from("orders")
    .select("day_number, created_at, mode, requested_time, payment_method, payment_status, total_cents, delivery_fee_cents, customer_name, customer_phone, address, postcode, city, note, late_print, order_lines ( item_name, options, qty, unit_cents )")
    .eq("restaurant_id", current.id).eq("business_day", dag).order("created_at");
  const rows = (data ?? []) as unknown as (TicketOrder & { late_print: boolean; order_lines: TicketLine[] })[];
  const base = `/beheer/bonnen?zaak=${current.slug}&dag=${dag}`;
  return (
    <>
      <div className="noprint" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div><h1 className="ph" style={{ margin: 0 }}>Bonnen van {longDate(dag)}</h1><p className="muted small" style={{ margin: 0 }}>{current.name} · {rows.length} keukenbonnen · {rows.filter((o) => o.mode === "levering").length} bezorgbonnen</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="seg2">
            {(["alle", "keuken", "bezorging"] as const).map((s) => <Link key={s} href={`${base}&soort=${s}`} aria-current={soort === s ? "page" : undefined}>{s === "alle" ? "Alle" : s === "keuken" ? "Keuken" : "Bezorging"}</Link>)}
          </div>
          <PrintButton />
          <Link className="btn" href={`/beheer?zaak=${current.slug}&dag=${dag}`}>Terug</Link>
        </div>
      </div>
      <div className="bongrid">
        {rows.map((o) => {
          const ord = { ...o, late: o.late_print };
          return [
            soort !== "bezorging" && <pre className="bon" key={`k${o.day_number}`}>{kitchenTicket(current.name, ord, o.order_lines)}</pre>,
            soort !== "keuken" && o.mode === "levering" && <pre className="bon" key={`b${o.day_number}`}>{deliveryTicket(current.name, ord, o.order_lines)}</pre>,
          ];
        })}
      </div>
    </>
  );
}
