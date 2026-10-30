import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import PanelNav from "@/components/PanelNav";
import { panel } from "@/lib/panel";
import { userDb } from "@/lib/supabase-server";
import { toCents, fromCents } from "@/lib/euro";
import { DAYS, cleanPostcode } from "@/lib/hours";
import { adminDb } from "@/lib/supabase";
import { addDomain, cleanDomain, domainStatus, domainsEnabled, isApex, removeDomain } from "@/lib/vercel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Instellingen" };

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function saveZaak(f: FormData) {
  "use server";
  const db = await userDb();
  const fee = toCents(f.get("fee")), min = toCents(f.get("min"));
  const prep = Math.min(180, Math.max(5, Number(s(f, "prep")) || 25));
  const { data } = await db.from("restaurants").update({
    name: s(f, "name").slice(0, 60), phone: s(f, "phone").slice(0, 30) || null, street: s(f, "street").slice(0, 100) || null,
    postcode: s(f, "postcode").slice(0, 10) || null, city: s(f, "city").slice(0, 60) || null,
    delivery_fee_cents: fee ?? 0, min_order_cents: min ?? 0, prep_minutes: prep,
    is_open: f.get("is_open") === "on", paused_reason: f.get("is_open") === "on" ? null : "handmatig",
    in_gids: f.get("in_gids") === "on",
  }).eq("id", s(f, "rid")).select("slug").single();
  if (data) revalidatePath(`/${data.slug}`);
  redirect(`/beheer/instellingen?zaak=${data?.slug ?? ""}&ok=1`);
}

async function saveBrand(f: FormData) {
  "use server";
  const db = await userDb();
  const rid = s(f, "rid");
  const hex = (v: string, d: string) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
  const update: Record<string, string> = { brand_primary: hex(s(f, "primary"), "#16213e"), brand_accent: hex(s(f, "accent"), "#ff6a00") };
  const logo = f.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 2 * 1024 * 1024 || !/^image\/(png|jpeg|webp)$/.test(logo.type)) redirect(`/beheer/instellingen?fout=logo`);
    const ext = logo.type.split("/")[1];
    const path = `${rid}/logo-${Date.now()}.${ext}`;
    const { error } = await db.storage.from("zaak-media").upload(path, logo, { contentType: logo.type, upsert: false });
    if (!error) update.logo_path = path;
  }
  const { data } = await db.from("restaurants").update(update).eq("id", rid).select("slug").single();
  if (data) revalidatePath(`/${data.slug}`);
  redirect(`/beheer/instellingen?zaak=${data?.slug ?? ""}&ok=1`);
}

/** Owner of this restaurant on the Pro plan? (RLS decides membership.) */
async function proRestaurant(rid: string) {
  const db = await userDb();
  const { data: r } = await db.from("restaurants").select("id, slug, company_id, custom_domain, restaurant_members!inner(user_id)").eq("id", rid).maybeSingle();
  const { data: adm } = await db.from("platform_admins").select("user_id").maybeSingle();
  const row = r ?? (adm ? (await db.from("restaurants").select("id, slug, company_id, custom_domain").eq("id", rid).maybeSingle()).data : null);
  if (!row) return null;
  const { data: co } = await db.from("companies").select("plan").eq("id", row.company_id).maybeSingle();
  return co?.plan === "pro" ? row : null;
}

async function saveDomain(f: FormData) {
  "use server";
  const r = await proRestaurant(s(f, "rid"));
  if (!r) redirect("/beheer/instellingen");
  const d = cleanDomain(s(f, "domain"));
  if (!d) redirect(`/beheer/instellingen?zaak=${r.slug}&fout=domein#domein`);
  const db = adminDb();
  const { data: taken } = await db.from("restaurants").select("id").eq("custom_domain", d).neq("id", r.id).maybeSingle();
  if (taken) redirect(`/beheer/instellingen?zaak=${r.slug}&fout=domeinbezet#domein`);
  if (r.custom_domain && r.custom_domain !== d) await removeDomain(r.custom_domain);
  const res = await addDomain(d);
  await db.from("restaurants").update({ custom_domain: d, domain_verified: false }).eq("id", r.id);
  redirect(`/beheer/instellingen?zaak=${r.slug}${res.ok || res.error === "geen-token" ? "" : "&fout=vercel"}#domein`);
}

async function checkDomain(f: FormData) {
  "use server";
  const r = await proRestaurant(s(f, "rid"));
  if (!r?.custom_domain) redirect("/beheer/instellingen");
  const st = await domainStatus(r.custom_domain);
  await adminDb().from("restaurants").update({ domain_verified: st.ok }).eq("id", r.id);
  redirect(`/beheer/instellingen?zaak=${r.slug}&domein=${st.ok ? "ok" : "nog"}#domein`);
}

async function dropDomain(f: FormData) {
  "use server";
  const r = await proRestaurant(s(f, "rid"));
  if (!r?.custom_domain) redirect("/beheer/instellingen");
  await removeDomain(r.custom_domain);
  await adminDb().from("restaurants").update({ custom_domain: null, domain_verified: false }).eq("id", r.id);
  redirect(`/beheer/instellingen?zaak=${r.slug}#domein`);
}

const T = (v: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "");

async function saveHours(f: FormData) {
  "use server";
  const db = await userDb();
  const rid = s(f, "rid");
  const rows: { restaurant_id: string; weekday: number; opens: string; closes: string }[] = [];
  for (let d = 0; d < 7; d++) {
    if (f.get(`dicht_${d}`) === "on") continue;
    for (const k of [1, 2]) {
      const o = T(s(f, `o${k}_${d}`)), c = T(s(f, `c${k}_${d}`));
      if (o && c && o !== c) rows.push({ restaurant_id: rid, weekday: d, opens: o, closes: c });
    }
  }
  const { data: r } = await db.from("restaurants").select("slug").eq("id", rid).single(); // RLS-check
  if (!r) redirect("/beheer/instellingen");
  await db.from("opening_hours").delete().eq("restaurant_id", rid);
  if (rows.length) await db.from("opening_hours").insert(rows);
  revalidatePath(`/${r.slug}`);
  redirect(`/beheer/instellingen?zaak=${r.slug}&ok=1#uren`);
}

async function saveZones(f: FormData) {
  "use server";
  const db = await userDb();
  const rid = s(f, "rid");
  const map = new Map<string, { restaurant_id: string; postcode: string; fee_cents: number; min_order_cents: number }>();
  for (let i = 0; i < 40; i++) {
    if (!f.has(`pc_${i}`)) break;
    const fee = toCents(f.get(`fee_${i}`)) ?? 0, min = toCents(f.get(`min_${i}`)) ?? 0;
    for (const raw of String(f.get(`pc_${i}`) ?? "").slice(0, 200).split(/[\s,;]+/)) {
      const pc = cleanPostcode(raw);
      if (pc.length === 4) map.set(pc, { restaurant_id: rid, postcode: pc, fee_cents: fee, min_order_cents: min });
    }
  }
  const { data: r } = await db.from("restaurants").select("slug").eq("id", rid).single();
  if (!r) redirect("/beheer/instellingen");
  await db.from("delivery_zones").delete().eq("restaurant_id", rid);
  if (map.size) await db.from("delivery_zones").insert([...map.values()]);
  revalidatePath(`/${r.slug}`);
  redirect(`/beheer/instellingen?zaak=${r.slug}&ok=1#zones`);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ zaak?: string; ok?: string; fout?: string; domein?: string }> }) {
  const sp = await searchParams;
  const { db, restaurants, current } = await panel(sp.zaak);
  if (!current) return null;
  const { data: r } = await db.from("restaurants").select("*").eq("id", current.id).single();
  const { data: co } = await db.from("companies").select("plan").eq("id", current.company_id).maybeSingle();
  const pro = co?.plan === "pro";
  const [{ data: hours }, { data: zones }] = await Promise.all([
    db.from("opening_hours").select("weekday, opens, closes").eq("restaurant_id", current.id).order("opens"),
    db.from("delivery_zones").select("postcode, fee_cents, min_order_cents").eq("restaurant_id", current.id).order("postcode"),
  ]);
  // Group postcodes with the same price into one row.
  const zoneRows = Object.values((zones ?? []).reduce<Record<string, { pcs: string[]; fee: number; min: number }>>((acc, z) => {
    const k = `${z.fee_cents}|${z.min_order_cents}`;
    (acc[k] ??= { pcs: [], fee: z.fee_cents, min: z.min_order_cents }).pcs.push(z.postcode);
    return acc;
  }, {}));
  const storage = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zaak-media/`;
  if (!r) return null;
  return (
    <>
      <PanelNav active="instellingen" restaurants={restaurants} current={current} />
      <h1 className="ph">Instellingen</h1>
      {sp.ok && <div className="okmsg">Opgeslagen. Je bestelpagina is bijgewerkt.</div>}
      {sp.fout === "logo" && <div className="alert">Het logo moet een PNG, JPG of WebP van maximaal 2 MB zijn.</div>}
      <div className="sgrid">
        <form action={saveZaak} className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <input type="hidden" name="rid" value={r.id} />
          <h2 className="h2">Zaak</h2>
          <label className="check big"><input type="checkbox" name="is_open" defaultChecked={r.is_open} /> Online bestellingen aannemen</label>
          <label className="check"><input type="checkbox" name="in_gids" defaultChecked={r.in_gids} /> Toon mijn zaak in de BestelBon-gids (klanten zoeken er op postcode naar zaken die leveren of in de buurt liggen)</label>
          <div className="fgrid">
            <label className="field">Naam<input name="name" defaultValue={r.name} required /></label>
            <label className="field">Telefoon<input name="phone" defaultValue={r.phone ?? ""} /></label>
            <label className="field" style={{ gridColumn: "1/-1" }}>Straat en nummer<input name="street" defaultValue={r.street ?? ""} /></label>
            <label className="field">Postcode<input name="postcode" defaultValue={r.postcode ?? ""} /></label>
            <label className="field">Gemeente<input name="city" defaultValue={r.city ?? ""} /></label>
          </div>
          <h2 className="h2" style={{ marginTop: 8 }}>Levering</h2>
          <div className="fgrid">
            <label className="field">Leverkost (€)<input name="fee" defaultValue={fromCents(r.delivery_fee_cents)} inputMode="decimal" /></label>
            <label className="field">Minimum voor levering (€)<input name="min" defaultValue={fromCents(r.min_order_cents)} inputMode="decimal" /></label>
            <label className="field">Bereidingstijd (min)<input name="prep" type="number" min={5} max={180} defaultValue={r.prep_minutes} /></label>
          </div>
          <div><button className="btn btn-primary">Opslaan</button></div>
        </form>
        <section className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <h2 className="h2">Logo en kleuren <span className="pill">{pro ? "Pro" : "Pro-functie"}</span></h2>
          {pro ? (
            <form action={saveBrand} style={{ display: "grid", gap: 12 }}>
              <input type="hidden" name="rid" value={r.id} />
              <div className="brandprev" style={{ background: r.brand_primary }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.logo_path ? <img src={storage + r.logo_path} alt="Huidig logo" /> : <span className="mono">{r.name[0]}</span>}
                <b>{r.name}</b>
                <span className="dot2" style={{ background: r.brand_accent }}>+</span>
              </div>
              <label className="field">Logo (PNG, JPG of WebP, max. 2 MB)<input type="file" name="logo" accept="image/png,image/jpeg,image/webp" /></label>
              <div className="fgrid">
                <label className="field">Hoofdkleur<input type="color" name="primary" defaultValue={r.brand_primary} /></label>
                <label className="field">Knoppen<input type="color" name="accent" defaultValue={r.brand_accent} /></label>
              </div>
              <div><button className="btn btn-primary">Opslaan</button></div>
            </form>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Met het Pro-pakket toont je bestelpagina je eigen logo en kleuren. Vraag het aan via info@bestelbon.eu.</p>
          )}
        </section>
      </div>
      <section className="panel" id="domein" style={{ display: "grid", gap: 12 }}>
        <h2 className="h2">Eigen domeinnaam <span className="pill">{pro ? "Pro" : "Pro-functie"}</span></h2>
        {!pro ? (
          <p className="muted" style={{ margin: 0 }}>Met het Pro-pakket staat je bestelpagina op je eigen adres, bijvoorbeeld bestellen.jouwzaak.be, met een gratis SSL-certificaat. Vraag het aan via info@bestelbon.eu.</p>
        ) : (
          <>
            {sp.fout === "domein" && <div className="alert">Dit is geen geldige domeinnaam. Vul bijvoorbeeld bestellen.jouwzaak.be in.</div>}
            {sp.fout === "domeinbezet" && <div className="alert">Deze domeinnaam is al in gebruik bij een andere zaak.</div>}
            {sp.fout === "vercel" && <div className="alert">De domeinnaam kon niet worden toegevoegd. Mail naar info@bestelbon.eu, we helpen je verder.</div>}
            {sp.domein === "ok" && <div className="okmsg">Je domein werkt. Je bestelpagina staat nu ook op https://{r.custom_domain}</div>}
            {sp.domein === "nog" && <div className="alert">Nog niet klaar. Controleer de DNS-instelling hieronder; een wijziging kan tot een uur duren.</div>}
            {r.custom_domain ? (
              <>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <b style={{ fontSize: 17 }}>{r.custom_domain}</b>
                  <span className={`pill ${r.domain_verified ? "ok" : "wait"}`}>{r.domain_verified ? "Actief" : "Wacht op DNS"}</span>
                  {r.domain_verified && <a className="btn" href={`https://${r.custom_domain}`} target="_blank" rel="noopener">Openen</a>}
                </div>
                {!r.domain_verified && (
                  <div className="small" style={{ display: "grid", gap: 6 }}>
                    <span>Zet bij je domeinbeheerder (bv. Combell, One.com, je webdesigner) dit DNS-record:</span>
                    <table className="tbl" style={{ maxWidth: 560 }}><thead><tr><th>Type</th><th>Naam</th><th>Waarde</th></tr></thead><tbody>
                      {isApex(r.custom_domain)
                        ? <tr><td>A</td><td>@</td><td className="mono">76.76.21.21</td></tr>
                        : <tr><td>CNAME</td><td className="mono">{r.custom_domain.split(".")[0]}</td><td className="mono">cname.vercel-dns.com</td></tr>}
                    </tbody></table>
                    <span className="muted">Daarna klik je op Controleren. Het SSL-certificaat komt automatisch.</span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!r.domain_verified && <form action={checkDomain}><input type="hidden" name="rid" value={r.id} /><button className="btn btn-primary">Controleren</button></form>}
                  <details className="confirm"><summary className="btn btn-ghost">Domein verwijderen</summary>
                    <form action={dropDomain} className="confirm-box"><input type="hidden" name="rid" value={r.id} /><span className="small">Je bestelpagina blijft bereikbaar op bestelbon.eu/{r.slug}.</span><button className="btn btn-danger">Ja, verwijderen</button></form>
                  </details>
                </div>
              </>
            ) : (
              <form action={saveDomain} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                <input type="hidden" name="rid" value={r.id} />
                <label className="field" style={{ flex: "1 1 260px" }}>Domeinnaam<input name="domain" placeholder="bestellen.jouwzaak.be" required /></label>
                <button className="btn btn-primary">Koppelen</button>
              </form>
            )}
            {!domainsEnabled() && <p className="muted small" style={{ margin: 0 }}>Koppelen gebeurt nu manueel door BestelBon. We laten je weten wanneer het actief is.</p>}
          </>
        )}
      </section>
      <div className="stack2">
        <form action={saveHours} className="panel" id="uren" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <input type="hidden" name="rid" value={r.id} />
          <h2 className="h2">Openingsuren</h2>
          <p className="muted small" style={{ margin: 0 }}>Buiten deze uren neemt je bestelpagina geen bestellingen aan. Vóór de opening kunnen klanten al bestellen voor later die dag. Een tweede shift is optioneel, bijvoorbeeld 11:30–14:00 en 17:00–21:30.</p>
          <div className="hgrid">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const rows = (hours ?? []).filter((h) => h.weekday === d);
              const v = (i: number, k: "opens" | "closes") => rows[i]?.[k]?.slice(0, 5) ?? "";
              return (
                <div key={d} className="hrow">
                  <b>{DAYS[d]}</b>
                  <label className="check small"><input type="checkbox" name={`dicht_${d}`} defaultChecked={!rows.length && (hours ?? []).length > 0} /> gesloten</label>
                  <span className="hshift"><input type="time" name={`o1_${d}`} defaultValue={v(0, "opens")} aria-label={`${DAYS[d]} open`} />–<input type="time" name={`c1_${d}`} defaultValue={v(0, "closes")} aria-label={`${DAYS[d]} dicht`} /></span>
                  <span className="hshift"><input type="time" name={`o2_${d}`} defaultValue={v(1, "opens")} aria-label={`${DAYS[d]} open 2`} />–<input type="time" name={`c2_${d}`} defaultValue={v(1, "closes")} aria-label={`${DAYS[d]} dicht 2`} /></span>
                </div>
              );
            })}
          </div>
          {!(hours ?? []).length && <div className="alert">Nog geen openingsuren: je bestelpagina neemt nu altijd bestellingen aan.</div>}
          <div><button className="btn btn-primary">Openingsuren opslaan</button></div>
        </form>
        <form action={saveZones} className="panel" id="zones" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <input type="hidden" name="rid" value={r.id} />
          <h2 className="h2">Bezorgzones</h2>
          <p className="muted small" style={{ margin: 0 }}>Vul de postcodes in waar je levert, met leverkost en minimum. Meerdere postcodes met dezelfde prijs mag op één lijn, gescheiden door een komma. Zonder zones lever je overal aan de leverkost hierboven.</p>
          <div className="zgrid">
            <span className="muted small">Postcodes</span><span className="muted small">Leverkost €</span><span className="muted small">Minimum €</span>
            {[...zoneRows, ...Array.from({ length: Math.max(2, 4 - zoneRows.length) }, () => null)].map((z, i) => (
              <div key={i} style={{ display: "contents" }}>
                <input name={`pc_${i}`} defaultValue={z?.pcs.join(", ") ?? ""} placeholder={i === 0 ? "2180, 2170" : ""} aria-label="Postcodes" />
                <input name={`fee_${i}`} defaultValue={z ? fromCents(z.fee) : ""} inputMode="decimal" placeholder={i === 0 ? "2,50" : ""} aria-label="Leverkost" />
                <input name={`min_${i}`} defaultValue={z ? fromCents(z.min) : ""} inputMode="decimal" placeholder={i === 0 ? "15,00" : ""} aria-label="Minimum" />
              </div>
            ))}
          </div>
          <div><button className="btn btn-primary">Zones opslaan</button></div>
        </form>
      </div>
    </>
  );
}
