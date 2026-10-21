import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import PanelNav from "@/components/PanelNav";
import { panel } from "@/lib/panel";
import { adminDb } from "@/lib/supabase";
import { userDb } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Printers" };

async function addPrinter(form: FormData) {
  "use server";
  const db = await userDb();
  const restaurant_id = String(form.get("restaurant_id"));
  const role = String(form.get("role")) as "keuken" | "bezorging" | "bar";
  const connection = String(form.get("connection")) as "kabel" | "wifi";
  const copies = Math.min(3, Math.max(1, Number(form.get("copies")) || 1));
  const name = String(form.get("name") || "Printer").slice(0, 40);
  const token = randomBytes(24).toString("base64url");
  const token_hash = createHash("sha256").update(token).digest("hex");
  const { error } = await db.from("printers").insert({ restaurant_id, role, connection, copies, name, token_hash });
  if (!error) (await cookies()).set("bb_new_printer", token, { maxAge: 300, httpOnly: true, sameSite: "strict", path: "/beheer/printers" });
  revalidatePath("/beheer/printers");
}

async function deletePrinter(form: FormData) {
  "use server";
  const db = await userDb();
  await db.from("printers").delete().eq("id", String(form.get("id"))); // RLS: alleen eigen zaak
  revalidatePath("/beheer/printers");
}

async function testPrint(form: FormData) {
  "use server";
  const db = await userDb();
  const { data: p } = await db.from("printers").select("id, restaurant_id").eq("id", String(form.get("id"))).maybeSingle(); // RLS-check
  if (p) await adminDb().from("print_jobs").insert({ printer_id: p.id, restaurant_id: p.restaurant_id, kind: "keuken", order_id: null });
  revalidatePath("/beheer/printers");
}

export default async function Page({ searchParams }: { searchParams: Promise<{ zaak?: string }> }) {
  const sp = await searchParams;
  const { db, restaurants, current } = await panel(sp.zaak);
  if (!current) return null;
  const fresh = (await cookies()).get("bb_new_printer")?.value;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data: printers } = await db.from("printers").select("id, name, role, connection, copies, last_seen_at").eq("restaurant_id", current.id).order("created_at");
  const online = (d: string | null) => !!d && Date.now() - new Date(d).getTime() < 120000;
  const ago = (d: string | null) => {
    if (!d) return "nog nooit";
    const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
    return s < 60 ? `${s} s geleden` : s < 3600 ? `${Math.round(s / 60)} min geleden` : s < 86400 ? `${Math.round(s / 3600)} u geleden` : `${Math.round(s / 86400)} dagen geleden`;
  };
  return (
    <>
      <PanelNav active="printers" restaurants={restaurants} current={current} />
      <h1 className="ph">Printers</h1>
      {fresh && (
        <div className="panel" style={{ borderColor: "var(--accent)" }}>
          <b>Printer aangemaakt.</b> Zet deze server-URL in de CloudPRNT-instellingen van de printer, interval 3 seconden. Ze wordt maar één keer getoond.
          <code className="url">{base}/api/cloudprnt/{fresh}</code>
        </div>
      )}
      {!(printers ?? []).some((p) => online(p.last_seen_at)) && <div className="alert">Geen printer online. Online bestellen wordt automatisch gepauzeerd zolang er geen printer bereikbaar is.</div>}
      <div className="plist">
        {(printers ?? []).map((p) => (
          <div className="panel pcard" key={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div><b>{p.name}</b><div className="muted small">{p.role === "keuken" ? "Keukenbon" : p.role === "bezorging" ? "Bezorgbon" : "Barbon"} · {p.connection} · {p.copies}×</div></div>
              <span className={`pill ${online(p.last_seen_at) ? "ok" : "wait"}`}>{online(p.last_seen_at) ? "Online" : p.last_seen_at ? "Offline" : "Nog geen contact"}</span>
            </div>
            <div className="muted small">Laatste contact: {ago(p.last_seen_at)}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <form action={testPrint}><input type="hidden" name="id" value={p.id} /><button className="btn">Testafdruk</button></form>
              <details className="confirm"><summary className="btn btn-ghost">Verwijderen</summary>
                <form action={deletePrinter} className="confirm-box"><input type="hidden" name="id" value={p.id} /><span className="small">Printer verwijderen? Wachtende bonnen voor deze printer vervallen.</span><button className="btn btn-danger">Ja, verwijderen</button></form>
              </details>
            </div>
          </div>
        ))}
      </div>
      <form action={addPrinter} className="panel" style={{ display: "grid", gap: 10, maxWidth: 560 }}>
        <h2 className="h2">Printer toevoegen</h2>
        <input type="hidden" name="restaurant_id" value={current.id} />
        <label className="field">Naam<input name="name" defaultValue={(printers ?? []).some((p) => p.role === "keuken") ? "Bezorgprinter" : "Keukenprinter"} /></label>
        <div className="fgrid">
          <label className="field">Drukt af<select name="role" defaultValue={(printers ?? []).some((p) => p.role === "keuken") ? "bezorging" : "keuken"}><option value="keuken">Keukenbon</option><option value="bezorging">Bezorgbon</option><option value="bar">Barbon</option></select></label>
          <label className="field">Verbinding<select name="connection"><option value="kabel">Netwerkkabel</option><option value="wifi">Wifi</option></select></label>
          <label className="field">Kopieën<select name="copies"><option>1</option><option>2</option><option>3</option></select></label>
        </div>
        <button className="btn btn-primary">Printer aanmaken</button>
      </form>
    </>
  );
}
