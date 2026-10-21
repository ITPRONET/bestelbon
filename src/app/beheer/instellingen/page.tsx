import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import PanelNav from "@/components/PanelNav";
import { panel } from "@/lib/panel";
import { userDb } from "@/lib/supabase-server";
import { toCents, fromCents } from "@/lib/euro";

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
    if (logo.size > 2 * 1024 * 1024 || !/^image\/(png|jpeg|webp|svg\+xml)$/.test(logo.type)) redirect(`/beheer/instellingen?fout=logo`);
    const ext = logo.type === "image/svg+xml" ? "svg" : logo.type.split("/")[1];
    const path = `${rid}/logo-${Date.now()}.${ext}`;
    const { error } = await db.storage.from("zaak-media").upload(path, logo, { contentType: logo.type, upsert: false });
    if (!error) update.logo_path = path;
  }
  const { data } = await db.from("restaurants").update(update).eq("id", rid).select("slug").single();
  if (data) revalidatePath(`/${data.slug}`);
  redirect(`/beheer/instellingen?zaak=${data?.slug ?? ""}&ok=1`);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ zaak?: string; ok?: string; fout?: string }> }) {
  const sp = await searchParams;
  const { db, restaurants, current } = await panel(sp.zaak);
  if (!current) return null;
  const { data: r } = await db.from("restaurants").select("*").eq("id", current.id).single();
  const { data: co } = await db.from("companies").select("plan").eq("id", current.company_id).maybeSingle();
  const pro = co?.plan === "pro";
  const storage = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zaak-media/`;
  if (!r) return null;
  return (
    <>
      <PanelNav active="instellingen" restaurants={restaurants} current={current} />
      <h1 className="ph">Instellingen</h1>
      {sp.ok && <div className="okmsg">Opgeslagen. Je bestelpagina is bijgewerkt.</div>}
      {sp.fout === "logo" && <div className="alert">Het logo moet een PNG, JPG, WebP of SVG van maximaal 2 MB zijn.</div>}
      <div className="sgrid">
        <form action={saveZaak} className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <input type="hidden" name="rid" value={r.id} />
          <h2 className="h2">Zaak</h2>
          <label className="check big"><input type="checkbox" name="is_open" defaultChecked={r.is_open} /> Online bestellingen aannemen</label>
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
              <label className="field">Logo (PNG, JPG, WebP of SVG, max. 2 MB)<input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></label>
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
    </>
  );
}
