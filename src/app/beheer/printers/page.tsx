import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { userDb } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Printers" };

async function addPrinter(form: FormData) {
  "use server";
  const db = await userDb();
  const restaurant_id = String(form.get("restaurant_id"));
  const role = String(form.get("role")) as "keuken" | "bezorging" | "bar";
  const connection = String(form.get("connection")) as "kabel" | "wifi";
  const name = String(form.get("name") || "Printer").slice(0, 40);
  const token = randomBytes(24).toString("base64url");
  const token_hash = createHash("sha256").update(token).digest("hex");
  const { error } = await db.from("printers").insert({ restaurant_id, role, connection, name, token_hash });
  if (!error) {
    // The token is shown once. We keep it in a short-lived cookie so the page can display it.
    const { cookies } = await import("next/headers");
    (await cookies()).set("bb_new_printer", token, { maxAge: 300, httpOnly: true, sameSite: "strict", path: "/beheer/printers" });
  }
  revalidatePath("/beheer/printers");
}

export default async function Page() {
  const db = await userDb();
  const { cookies } = await import("next/headers");
  const fresh = (await cookies()).get("bb_new_printer")?.value;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data: rs } = await db.from("restaurants").select("id, name, restaurant_members!inner(user_id)");
  const { data: printers } = await db.from("printers").select("id, restaurant_id, name, role, connection, last_seen_at").order("created_at");
  const online = (d: string | null) => !!d && Date.now() - new Date(d).getTime() < 120000;
  return (
    <>
      <h1 style={{ margin: 0 }}>Printers</h1>
      {fresh && (
        <div className="panel" style={{ borderColor: "var(--accent)" }}>
          <b>Nieuwe printer aangemaakt.</b> Zet deze server-URL in de CloudPRNT-instellingen van de printer (interval 3 seconden). Ze wordt maar één keer getoond.
          <code className="url">{base}/api/cloudprnt/{fresh}</code>
        </div>
      )}
      <div className="panel" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Naam</th><th>Zaak</th><th>Drukt af</th><th>Verbinding</th><th>Status</th></tr></thead>
          <tbody>
            {(printers ?? []).map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{rs?.find((r) => r.id === p.restaurant_id)?.name}</td><td>{p.role}</td><td>{p.connection}</td>
                <td><span className={`pill ${online(p.last_seen_at) ? "ok" : "wait"}`}>{online(p.last_seen_at) ? "Online" : p.last_seen_at ? "Offline" : "Nog geen contact"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={addPrinter} className="panel" style={{ display: "grid", gap: 10, maxWidth: 520 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Printer toevoegen</h2>
        <label className="field">Zaak<select name="restaurant_id">{rs?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label className="field">Naam<input name="name" defaultValue="Keukenprinter" /></label>
        <label className="field">Drukt af<select name="role"><option value="keuken">Keukenbon</option><option value="bezorging">Bezorgbon</option><option value="bar">Barbon</option></select></label>
        <label className="field">Verbinding<select name="connection"><option value="kabel">Netwerkkabel</option><option value="wifi">Wifi</option></select></label>
        <button className="btn btn-primary">Printer aanmaken</button>
      </form>
    </>
  );
}
