import { userDb } from "@/lib/supabase-server";
import { eur } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bestellingen" };

const label: Record<string, [string, string]> = {
  geprint: ["Geprint", "ok"], in_wachtrij: ["Wacht op printer", "wait"], wacht_op_betaling: ["Wacht op betaling", "wait"], geannuleerd: ["Geannuleerd", ""],
};

export default async function Page() {
  const db = await userDb();
  const { data: rs } = await db.from("restaurants").select("id, name, slug, restaurant_members!inner(user_id)");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Brussels" });
  const { data: orders } = await db.from("orders")
    .select("id, restaurant_id, day_number, created_at, mode, status, total_cents, customer_name, payment_method")
    .eq("business_day", today).order("created_at", { ascending: false });
  if (!rs?.length) return <p>Je account is nog niet gekoppeld aan een zaak. Neem contact op met info@bestelbon.eu.</p>;
  return rs.map((r) => {
    const list = (orders ?? []).filter((o) => o.restaurant_id === r.id);
    const sum = list.reduce((s, o) => s + o.total_cents, 0);
    return (
      <section className="panel" key={r.id}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>{r.name}</h1>
          <span className="muted">Vandaag: <b className="num">{list.length}</b> bestellingen · <b className="num">{eur(sum)}</b></span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ marginTop: 10 }}>
            <thead><tr><th>#</th><th>Tijd</th><th>Klant</th><th>Soort</th><th>Status</th><th style={{ textAlign: "right" }}>Totaal</th></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td><b>#{o.day_number}</b></td>
                  <td className="num">{new Date(o.created_at).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })}</td>
                  <td>{o.customer_name ?? "–"}</td>
                  <td>{o.mode}</td>
                  <td><span className={`pill ${label[o.status]?.[1] ?? ""}`}>{label[o.status]?.[0] ?? o.status}</span></td>
                  <td className="num" style={{ textAlign: "right" }}>{eur(o.total_cents)}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={6} className="muted">Nog geen bestellingen vandaag.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
  });
}
