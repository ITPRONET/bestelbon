import Link from "next/link";
import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { adminOnly } from "@/lib/admin";
import { shortDate } from "@/lib/invoice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aanvragen" };

const ST: Record<string, [string, string]> = { nieuw: ["Nieuw", "bad"], in_behandeling: ["In behandeling", "wait"], klant: ["Klant", "ok"], afgewezen: ["Afgewezen", ""] };

async function setStatus(f: FormData) {
  "use server";
  const db = await adminOnly();
  const st = String(f.get("status"));
  if (st in ST) await db.from("signups").update({ status: st }).eq("id", String(f.get("id")));
  redirect("/beheer/admin/aanvragen");
}

export default async function Page({ searchParams }: { searchParams: Promise<{ alle?: string }> }) {
  const sp = await searchParams;
  const db = await adminOnly();
  let q = db.from("signups").select("*").order("created_at", { ascending: false }).limit(200);
  if (!sp.alle) q = q.in("status", ["nieuw", "in_behandeling"]);
  const { data } = await q;
  return (
    <>
      <AdminNav active="aanvragen" />
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h1 className="ph" style={{ flex: 1 }}>Aanvragen</h1>
        <Link className="btn" href={sp.alle ? "/beheer/admin/aanvragen" : "/beheer/admin/aanvragen?alle=1"}>{sp.alle ? "Alleen open" : "Toon alle"}</Link>
        <a className="btn" href="/aanmelden" target="_blank" rel="noopener">Aanmeldformulier</a>
      </div>
      {!data?.length && <div className="panel muted">Geen {sp.alle ? "" : "open "}aanvragen.</div>}
      {data?.map((a) => (
        <section key={a.id} className="panel" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div><b style={{ fontSize: 17 }}>{a.restaurant_name}</b> <span className="muted small">· {a.restaurant_type} · {a.plan === "pro" ? "Pro" : "Standaard"} · {a.printers_cable}× kabel, {a.printers_wifi}× wifi</span>{a.gks === "ja" && <span className="pill bad" style={{ marginLeft: 6 }}>Witte kassa</span>}{a.gks === "weet_niet" && <span className="pill wait" style={{ marginLeft: 6 }}>Witte kassa?</span>}</div>
            <span className={`pill ${ST[a.status]?.[1]}`}>{ST[a.status]?.[0]}</span>
          </div>
          <div className="small">{a.legal_name} · {a.vat_number} · {a.street}, {a.postcode} {a.city}</div>
          <div className="small">{a.contact_name} · <a href={`tel:${a.phone}`}>{a.phone}</a> · <a href={`mailto:${a.email}`}>{a.email}</a></div>
          {a.message && <div className="small" style={{ background: "var(--bg)", borderRadius: 8, padding: "8px 10px" }}>{a.message}</div>}
          <div className="muted small">Ontvangen {shortDate(a.created_at.slice(0, 10))}{a.wanted_start ? ` · gewenste start ${shortDate(a.wanted_start)}` : ""} · voorwaarden {a.terms_version} aanvaard</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {a.company_id ? <Link className="btn" href={`/beheer/admin/bedrijf/${a.company_id}`}>Naar klant</Link> : <Link className="btn btn-primary" href={`/beheer/admin/nieuw?aanvraag=${a.id}`}>Klant aanmaken</Link>}
            <form action={setStatus} style={{ display: "flex", gap: 6 }}>
              <input type="hidden" name="id" value={a.id} />
              <select name="status" defaultValue={a.status} className="inp" aria-label="Status">{Object.entries(ST).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
              <button className="btn">Opslaan</button>
            </form>
          </div>
        </section>
      ))}
    </>
  );
}
