import { setupText, type Setup } from "@/lib/setup";
import { BLOCK_REASONS } from "@/lib/pricing";
import { revalidatePath } from "next/cache";
import { billingEnabled, charge } from "@/lib/billing";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { adminOnly, CO_STATUS, INST_STATUS, PLAN } from "@/lib/admin";
import { eur } from "@/lib/money";
import { toCents } from "@/lib/euro";
import { normVat } from "@/lib/vat";
import { PEPPOL, shortDate, shownStatus, STATUS } from "@/lib/invoice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Klant" };

const s = (f: FormData, k: string, n = 100) => String(f.get(k) ?? "").trim().slice(0, n);

async function saveCompany(f: FormData) {
  "use server";
  const db = await adminOnly();
  const id = s(f, "id");
  const vat = normVat(s(f, "vat_number"));
  if (!vat.ok) redirect(`/beheer/admin/bedrijf/${id}?fout=btw`);
  const status = s(f, "status");
  await db.from("companies").update({
    legal_name: s(f, "legal_name"), vat_number: vat.display, street: s(f, "street") || null, postcode: s(f, "postcode", 10) || null,
    city: s(f, "city", 60) || null, contact_name: s(f, "contact_name", 80) || null, email: s(f, "email"), phone: s(f, "phone", 30) || null,
    plan: s(f, "plan") === "pro" ? "pro" : "standaard", billing: s(f, "billing") === "jaar" ? "jaar" : "maand", status: status in CO_STATUS ? status : "installatie",
    started_on: s(f, "started_on") || undefined, ended_on: s(f, "ended_on") || null,
  }).eq("id", id);
  redirect(`/beheer/admin/bedrijf/${id}?ok=1`);
}

async function addInvoice(f: FormData) {
  "use server";
  const db = await adminOnly();
  const id = s(f, "id");
  const lines = [0, 1, 2, 3, 4].map((i) => ({ description: s(f, `d${i}`, 200), qty: Number(String(f.get(`q${i}`) ?? "1").replace(",", ".")) || 1, unit_cents: toCents(f.get(`p${i}`)) }))
    .filter((l) => l.description && l.unit_cents !== null);
  if (!lines.length) redirect(`/beheer/admin/bedrijf/${id}?fout=lijnen`);
  const { data: inv } = await db.rpc("create_invoice", { p_company: id, p_lines: lines, p_issued: s(f, "issued_on") || undefined, p_note: s(f, "note", 300) || null });
  redirect(inv ? `/beheer/factuur/${inv}` : `/beheer/admin/bedrijf/${id}?fout=factuur`);
}

async function saveInstall(f: FormData) {
  "use server";
  const db = await adminOnly();
  const st = s(f, "status");
  await db.from("installations").update({
    status: st in INST_STATUS ? st : "te_plannen", planned_on: s(f, "planned_on") || null, notes: s(f, "notes", 500) || null,
    done_on: st === "geinstalleerd" ? (s(f, "done_on") || new Date().toISOString().slice(0, 10)) : null,
  }).eq("id", s(f, "iid"));
  if (st === "geinstalleerd") await db.from("companies").update({ status: "actief" }).eq("id", s(f, "id")).eq("status", "installatie");
  redirect(`/beheer/admin/bedrijf/${s(f, "id")}?ok=1`);
}

async function resendLogin(f: FormData) {
  "use server";
  const db = await adminOnly();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await db.auth.resetPasswordForEmail(s(f, "email"), { redirectTo: `${site}/auth/bevestig` });
  redirect(`/beheer/admin/bedrijf/${s(f, "id")}?mail=1`);
}

async function addMember(f: FormData) {
  "use server";
  const db = await adminOnly();
  const email = s(f, "email").toLowerCase();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const inv = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/auth/bevestig` });
  let uid = inv.data.user?.id;
  if (!uid) uid = (await db.auth.admin.listUsers({ perPage: 1000 })).data?.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (uid) await db.from("restaurant_members").upsert({ restaurant_id: s(f, "rid"), user_id: uid, role: "eigenaar" });
  redirect(`/beheer/admin/bedrijf/${s(f, "id")}?${uid ? "mail=1" : "fout=account"}`);
}

async function chargeNow(f: FormData) {
  "use server";
  await adminOnly();
  const id = String(f.get("id") ?? ""), cid = String(f.get("cid") ?? "");
  let ok = false;
  try { ok = await charge(id); } catch (e) { console.error("charge", e); }
  redirect(`/beheer/admin/bedrijf/${cid}?${ok ? "ok=afgeschreven" : "fout=incasso"}`);
}

/** First month that has not been invoiced yet (YYYY-MM-01). */
async function nextOpenMonth(db: Awaited<ReturnType<typeof adminOnly>>, id: string) {
  const { data } = await db.from("invoices").select("period").eq("company_id", id).not("period", "is", null).order("period", { ascending: false }).limit(1).maybeSingle();
  const now = new Date().toISOString().slice(0, 7);
  const last = data?.period as string | undefined;
  if (!last || last < now) return `${now}-01`;
  const d = new Date(Date.UTC(Number(last.slice(0, 4)), Number(last.slice(5, 7)), 1));
  return d.toISOString().slice(0, 10);
}
const monthEnd = (first: string, add = 0) => new Date(Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5, 7)) + add, 0)).toISOString().slice(0, 10);

async function giveFreeMonth(f: FormData) {
  "use server";
  const db = await adminOnly();
  const id = String(f.get("id"));
  const n = Math.max(1, Math.min(12, Number(f.get("n")) || 1));
  const { data: co } = await db.from("companies").select("free_until").eq("id", id).single();
  const start = await nextOpenMonth(db, id);
  // Verleng vanaf de eerste nog niet gefactureerde maand, of vanaf de huidige gratis periode.
  const from = co?.free_until && co.free_until >= start ? `${co.free_until.slice(0, 7)}-01` : start;
  const until = co?.free_until && co.free_until >= start ? monthEnd(from, n + 1) : monthEnd(from, n);
  await db.from("companies").update({ free_until: until }).eq("id", id);
  redirect(`/beheer/admin/bedrijf/${id}?ok=gratis`);
}

async function saveDeal(f: FormData) {
  "use server";
  const db = await adminOnly();
  const id = String(f.get("id"));
  const pct = Math.max(0, Math.min(100, Math.round(Number(f.get("pct")) || 0)));
  const d = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(String(f.get(k) ?? "")) ? String(f.get(k)) : null);
  await db.from("companies").update({
    discount_pct: pct, discount_until: pct ? d("until") : null, discount_note: pct ? String(f.get("note") ?? "").trim().slice(0, 80) || null : null,
    free_until: d("free_until"),
  }).eq("id", id);
  redirect(`/beheer/admin/bedrijf/${id}?ok=1`);
}

async function setBlocked(f: FormData) {
  "use server";
  const db = await adminOnly();
  const id = String(f.get("id"));
  const block = f.get("block") === "1";
  const reason = String(f.get("reason") ?? "onbetaald");
  await db.from("companies").update(block ? { blocked_at: new Date().toISOString(), blocked_reason: reason in BLOCK_REASONS ? reason : "andere" } : { blocked_at: null, blocked_reason: null }).eq("id", id);
  const { data: rs } = await db.from("restaurants").select("slug").eq("company_id", id);
  for (const r of rs ?? []) revalidatePath(`/${r.slug}`);
  redirect(`/beheer/admin/bedrijf/${id}?ok=${block ? "geblokkeerd" : "gedeblokkeerd"}`);
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; fout?: string; nieuw?: string; mail?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = await adminOnly();
  const { data: co } = await db.from("companies").select("*").eq("id", id).maybeSingle();
  if (!co) notFound();
  const [{ data: rs }, { data: invs }, { data: inst }, { data: prices }] = await Promise.all([
    db.from("restaurants").select("id, name, slug, type, restaurant_members(user_id, role)").eq("company_id", id).order("name"),
    db.from("invoices").select("id, number, issued_on, due_on, status, total_cents, peppol_status, period, mollie_status").eq("company_id", id).order("seq", { ascending: false }),
    db.from("installations").select("*").eq("company_id", id).order("created_at"),
    db.from("prices").select("key, label, cents").order("cents"),
  ]);
  const uids = [...new Set((rs ?? []).flatMap((r) => (r.restaurant_members as { user_id: string }[]).map((m) => m.user_id)))];
  const users = await Promise.all(uids.map(async (u) => (await db.auth.admin.getUserById(u)).data.user));
  const mail = (u: string) => users.find((x) => x?.id === u);
  const errors: Record<string, string> = { incasso: "Afschrijven is niet gelukt: geen geldige domiciliëring, of er loopt al een betaling.", btw: "Het btw-nummer klopt niet.", lijnen: "Vul minstens één lijn in met omschrijving en prijs.", factuur: "Factuur maken is niet gelukt.", account: "Account aanmaken is niet gelukt.", bestaat: "Er bestaat al een bedrijf met dit btw-nummer. Dit is dat bedrijf." };
  const nieuw: Record<string, string> = { uitgenodigd: "Klant aangemaakt. De uitbater kreeg een e-mail om een wachtwoord te kiezen.", gekoppeld: "Klant aangemaakt en gekoppeld aan een bestaand account.", geenaccount: "Klant aangemaakt, maar het account kon niet worden aangemaakt. Nodig de uitbater hieronder opnieuw uit." };
  return (
    <>
      <AdminNav active="" />
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h1 className="ph" style={{ flex: 1 }}>{co.legal_name}</h1>
        <span className={`pill ${CO_STATUS[co.status]?.[1]}`}>{CO_STATUS[co.status]?.[0]}</span>
        <span className="pill">{PLAN[co.plan]}</span>
      </div>
      {sp.nieuw && <div className="okmsg">{nieuw[sp.nieuw]}</div>}
      {sp.ok && <div className="okmsg">{({ afgeschreven: "Afschrijving gestart bij Mollie.", gratis: "Gratis maand toegevoegd.", geblokkeerd: "Klant geblokkeerd: bestelpagina's nemen geen bestellingen meer aan.", gedeblokkeerd: "Klant gedeblokkeerd." } as Record<string, string>)[sp.ok] ?? "Opgeslagen."}</div>}
      {co.blocked_at && <div className="alert"><b>Geblokkeerd</b> sinds {shortDate(co.blocked_at.slice(0, 10))} · {BLOCK_REASONS[co.blocked_reason ?? ""] ?? co.blocked_reason}. De bestelpagina&apos;s nemen geen bestellingen aan.</div>}
      {sp.mail && <div className="okmsg">E-mail verstuurd.</div>}
      {sp.fout && <div className="alert">{errors[sp.fout] ?? "Er ging iets mis."}</div>}

      <div className="sgrid">
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <section className="panel" style={{ display: "grid", gap: 10 }}>
            <h2 className="h2">Zaken en logins</h2>
            {(rs ?? []).map((r) => (
              <div key={r.id} className="grp" style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <b>{r.name} <span className="muted small">· {r.type}</span></b>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Link className="btn" href={`/beheer?zaak=${r.slug}`}>Open paneel</Link>
                    <a className="btn" href={`/${r.slug}`} target="_blank" rel="noopener">Bestelpagina</a>
                  </span>
                </div>
                {(r.restaurant_members as { user_id: string; role: string }[]).map((m) => {
                  const u = mail(m.user_id);
                  return (
                    <form key={m.user_id} action={resendLogin} className="small" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input type="hidden" name="id" value={id} /><input type="hidden" name="email" value={u?.email ?? ""} />
                      <span>{u?.email ?? "onbekend"}</span>
                      <span className="muted">{u?.last_sign_in_at ? `laatst ingelogd ${shortDate(u.last_sign_in_at.slice(0, 10))}` : "nog nooit ingelogd"}</span>
                      <button className="btn btn-ghost">Login-mail opnieuw sturen</button>
                    </form>
                  );
                })}
                <form action={addMember} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input type="hidden" name="id" value={id} /><input type="hidden" name="rid" value={r.id} />
                  <input name="email" type="email" required placeholder="extra login (e-mail)" className="inp" />
                  <button className="btn">Uitnodigen</button>
                </form>
              </div>
            ))}
          </section>

          <section className="panel">
            <h2 className="h2">Facturen</h2>
            {billingEnabled() && <p className="small" style={{ margin: "0 0 8px" }}>{co.mandate_status === "valid" ? <><span className="pill ok">Domiciliëring</span> {co.mandate_label}</> : co.mandate_status ? <><span className="pill wait">Mandaat: {co.mandate_status}</span></> : <span className="muted">Nog geen domiciliëring. De klant activeert die door een factuur online te betalen in zijn panel (Facturen).</span>}</p>}
            {!invs?.length ? <p className="muted">Nog geen facturen.</p> : (
              <div className="tblwrap"><table className="tbl">
                <thead><tr><th>Nummer</th><th>Datum</th><th>Bedrag</th><th>Status</th><th>Peppol</th><th></th></tr></thead>
                <tbody>{invs.map((i) => { const st = shownStatus(i); return (
                  <tr key={i.id}><td><Link href={`/beheer/factuur/${i.id}`}>{i.number}</Link></td><td>{shortDate(i.issued_on)}</td><td>{eur(i.total_cents)}</td>
                    <td><span className={`pill ${STATUS[st]?.[1]}`}>{STATUS[st]?.[0]}</span></td><td className="small muted">{PEPPOL[i.peppol_status] ?? i.peppol_status}</td>
                    <td>{i.mollie_status && <small className="muted">Mollie: {i.mollie_status} </small>}{i.status === "open" && co.mandate_status === "valid" && !["pending", "open", "authorized", "paid"].includes(i.mollie_status ?? "") && <form action={chargeNow} style={{ display: "inline" }}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="cid" value={id} /><button className="btn">Nu afschrijven</button></form>}</td></tr>
                ); })}</tbody>
              </table></div>
            )}
            <details className="newinv">
              <summary className="btn btn-primary">+ Nieuwe factuur</summary>
              <form action={addInvoice} style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <input type="hidden" name="id" value={id} />
                <datalist id="presets">{prices?.map((p) => <option key={p.key} value={p.label} />)}</datalist>
                <p className="muted small" style={{ margin: 0 }}>Prijzen excl. btw. Standaardprijzen: {prices?.map((p) => `${p.label} ${eur(p.cents)}`).join(" · ")}</p>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="invline">
                    <input name={`d${i}`} list="presets" placeholder="Omschrijving" aria-label={`Omschrijving ${i + 1}`} />
                    <input name={`q${i}`} defaultValue="1" inputMode="decimal" aria-label="Aantal" />
                    <input name={`p${i}`} placeholder="€ 0,00" inputMode="decimal" aria-label="Prijs" />
                  </div>
                ))}
                <div className="fgrid">
                  <label className="field">Factuurdatum<input type="date" name="issued_on" /></label>
                  <label className="field">Opmerking op factuur<input name="note" /></label>
                </div>
                <div><button className="btn btn-primary">Factuur maken</button></div>
              </form>
            </details>
          </section>

          {(inst ?? []).map((i) => (
            <form key={i.id} action={saveInstall} className="panel" style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="id" value={id} /><input type="hidden" name="iid" value={i.id} />
              <h2 className="h2">Installatie <span className={`pill ${INST_STATUS[i.status]?.[1]}`}>{INST_STATUS[i.status]?.[0]}</span></h2>
              <div className="small">{i.printer_setup ? setupText(i.printer_setup as Setup) : `${i.printers_cable}× printer met kabel`}{i.powerline_adapters ? ` · ${i.powerline_adapters}× powerline-adapter` : ""}</div>
              <div className="fgrid">
                <label className="field">Status<select name="status" defaultValue={i.status}>{Object.entries(INST_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
                <label className="field">Gepland op<input type="date" name="planned_on" defaultValue={i.planned_on ?? ""} /></label>
                <label className="field">Uitgevoerd op<input type="date" name="done_on" defaultValue={i.done_on ?? ""} /></label>
                <label className="field" style={{ gridColumn: "1/-1" }}>Notities<textarea name="notes" rows={2} defaultValue={i.notes ?? ""} /></label>
              </div>
              <p className="muted small" style={{ margin: 0 }}>Op “Geïnstalleerd” zetten maakt het abonnement actief.</p>
              <div><button className="btn">Opslaan</button></div>
            </form>
          ))}
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
        <section className="panel" style={{ display: "grid", gap: 12 }}>
          <h2 className="h2">Korting en gratis maanden</h2>
          <p className="small" style={{ margin: 0 }}>
            {co.free_until && co.free_until >= new Date().toISOString().slice(0, 10) ? <><span className="pill ok">Gratis</span> abonnement t/m {shortDate(co.free_until)}</> : <span className="muted">Geen gratis periode.</span>}
            {co.discount_pct > 0 && <> · <span className="pill ok">−{co.discount_pct}%</span> {co.discount_until ? `t/m ${shortDate(co.discount_until)}` : "zonder einddatum"}{co.discount_note ? ` (${co.discount_note})` : ""}</>}
          </p>
          <form action={giveFreeMonth} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <input type="hidden" name="id" value={id} />
            <label className="field" style={{ width: 120 }}>Maanden<select name="n" defaultValue="1">{[1, 2, 3, 6, 12].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <button className="btn btn-primary">Gratis maand(en) geven</button>
          </form>
          <form action={saveDeal} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="id" value={id} />
            <div className="fgrid">
              <label className="field">Korting op abonnement (%)<input name="pct" type="number" min={0} max={100} defaultValue={co.discount_pct ?? 0} /></label>
              <label className="field">Korting t/m (leeg = altijd)<input name="until" type="date" defaultValue={co.discount_until ?? ""} /></label>
              <label className="field">Reden (op de factuur)<input name="note" maxLength={80} defaultValue={co.discount_note ?? ""} placeholder="bv. promotie opening" /></label>
              <label className="field">Gratis t/m<input name="free_until" type="date" defaultValue={co.free_until ?? ""} /></label>
            </div>
            <p className="muted small" style={{ margin: 0 }}>Geldt voor nieuwe maand- en jaarfacturen. Gratis maanden: geen maandfactuur; bij jaarbetaling worden ze afgetrokken van de jaarfactuur.</p>
            <div><button className="btn">Opslaan</button></div>
          </form>
        </section>
        <section className="panel" style={{ display: "grid", gap: 10 }}>
          <h2 className="h2">Blokkeren</h2>
          {co.blocked_at ? (
            <form action={setBlocked} style={{ display: "grid", gap: 8 }}>
              <input type="hidden" name="id" value={id} /><input type="hidden" name="block" value="0" />
              <p className="small" style={{ margin: 0 }}>Geblokkeerd sinds {shortDate(co.blocked_at.slice(0, 10))} ({BLOCK_REASONS[co.blocked_reason ?? ""] ?? co.blocked_reason}). Wordt automatisch opgeheven als de klant alle vervallen facturen online betaalt.</p>
              <div><button className="btn btn-primary">Deblokkeren</button></div>
            </form>
          ) : (
            <form action={setBlocked} style={{ display: "grid", gap: 8 }}>
              <input type="hidden" name="id" value={id} /><input type="hidden" name="block" value="1" />
              <p className="muted small" style={{ margin: 0 }}>De bestelpagina&apos;s van deze klant nemen dan geen bestellingen meer aan en de klant ziet in zijn paneel waarom. Het paneel en de facturen blijven bereikbaar, zodat hij kan betalen.</p>
              <label className="field">Reden<select name="reason" defaultValue="onbetaald">{Object.entries(BLOCK_REASONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <details className="confirm"><summary className="btn btn-danger">Blokkeren</summary>
                <div className="confirm-box"><span className="small">Bestellingen van deze klant stoppen meteen.</span><button className="btn btn-danger">Ja, blokkeren</button></div>
              </details>
            </form>
          )}
        </section>
        <form action={saveCompany} className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <input type="hidden" name="id" value={id} />
          <h2 className="h2">Gegevens en abonnement</h2>
          <div className="fgrid">
            <label className="field" style={{ gridColumn: "1/-1" }}>Bedrijfsnaam<input name="legal_name" defaultValue={co.legal_name} required /></label>
            <label className="field">Btw-nummer<input name="vat_number" defaultValue={co.vat_number} required /></label>
            <label className="field">Contactpersoon<input name="contact_name" defaultValue={co.contact_name ?? ""} /></label>
            <label className="field" style={{ gridColumn: "1/-1" }}>Straat en nummer<input name="street" defaultValue={co.street ?? ""} /></label>
            <label className="field">Postcode<input name="postcode" defaultValue={co.postcode ?? ""} /></label>
            <label className="field">Gemeente<input name="city" defaultValue={co.city ?? ""} /></label>
            <label className="field">E-mail<input name="email" type="email" defaultValue={co.email} required /></label>
            <label className="field">Telefoon<input name="phone" defaultValue={co.phone ?? ""} /></label>
            <label className="field">Pakket<select name="plan" defaultValue={co.plan}><option value="standaard">Standaard</option><option value="pro">Pro</option></select></label>
            <label className="field">Betaling<select name="billing" defaultValue={co.billing}><option value="maand">Maandelijks</option><option value="jaar">Jaarlijks vooraf (−10%)</option></select></label>
            <label className="field">Status<select name="status" defaultValue={co.status}>{Object.entries(CO_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="field">Start<input type="date" name="started_on" defaultValue={co.started_on} /></label>
            <label className="field">Einde<input type="date" name="ended_on" defaultValue={co.ended_on ?? ""} /></label>
          </div>
          <div><button className="btn btn-primary">Opslaan</button></div>
        </form>
        </div>
      </div>
    </>
  );
}
