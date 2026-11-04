import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import PanelNav from "@/components/PanelNav";
import { panel } from "@/lib/panel";
import { userDb } from "@/lib/supabase-server";
import { eur } from "@/lib/money";
import { toCents, fromCents } from "@/lib/euro";
import PhotoInput from "./PhotoInput";
import { TEMPLATES, templateFor, type TChoice } from "@/lib/menu-templates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu" };

type Choice = { id: string; name: string; extra_cents: number; position: number };
type Group = { id: string; name: string; multi: boolean; required: boolean; max_select: number | null; position: number; option_choices: Choice[] };
type Item = { id: string; name: string; description: string | null; price_cents: number; available: boolean; position: number; image_path: string | null; option_groups: Group[] };
type Cat = { id: string; name: string; position: number; menu_items: Item[]; option_groups: Group[] };

async function done(rid: string) {
  const db = await userDb();
  const { data } = await db.from("restaurants").select("slug").eq("id", rid).single();
  if (data) revalidatePath(`/${data.slug}`);
  revalidatePath("/beheer/menu");
}
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function addCategory(f: FormData) {
  "use server";
  const db = await userDb(); const rid = s(f, "rid");
  const { count } = await db.from("menu_categories").select("id", { count: "exact", head: true }).eq("restaurant_id", rid);
  await db.from("menu_categories").insert({ restaurant_id: rid, name: s(f, "name").slice(0, 60) || "Nieuwe categorie", position: (count ?? 0) + 1 });
  await done(rid);
}
async function renameCategory(f: FormData) {
  "use server";
  const db = await userDb();
  await db.from("menu_categories").update({ name: s(f, "name").slice(0, 60) }).eq("id", s(f, "id"));
  await done(s(f, "rid"));
}
async function deleteCategory(f: FormData) {
  "use server";
  const db = await userDb();
  await db.from("menu_categories").delete().eq("id", s(f, "id"));
  await done(s(f, "rid"));
}
async function moveCategory(f: FormData) {
  "use server";
  const db = await userDb(); const rid = s(f, "rid"), id = s(f, "id"), dir = Number(s(f, "dir"));
  const { data } = await db.from("menu_categories").select("id, position").eq("restaurant_id", rid).order("position");
  const list = data ?? []; const i = list.findIndex((c) => c.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((c, n) => db.from("menu_categories").update({ position: n + 1 }).eq("id", c.id)));
  await done(rid);
}
async function addItem(f: FormData) {
  "use server";
  const db = await userDb(); const rid = s(f, "rid"), cat = s(f, "cat");
  const price = toCents(f.get("price"));
  if (price === null || !s(f, "name")) return;
  const { count } = await db.from("menu_items").select("id", { count: "exact", head: true }).eq("category_id", cat);
  await db.from("menu_items").insert({ restaurant_id: rid, category_id: cat, name: s(f, "name").slice(0, 80), description: s(f, "description").slice(0, 200) || null, price_cents: price, position: (count ?? 0) + 1 });
  await done(rid);
}
async function saveItem(f: FormData) {
  "use server";
  const db = await userDb();
  const price = toCents(f.get("price"));
  if (price === null || !s(f, "name")) return;
  await db.from("menu_items").update({ name: s(f, "name").slice(0, 80), description: s(f, "description").slice(0, 200) || null, price_cents: price, available: f.get("available") === "on", category_id: s(f, "cat") }).eq("id", s(f, "id"));
  await done(s(f, "rid"));
}
async function savePhoto(f: FormData) {
  "use server";
  const db = await userDb();
  const rid = s(f, "rid"), id = s(f, "id");
  const photo = f.get("photo");
  if (!(photo instanceof File) || !photo.size || photo.size > 2 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(photo.type)) return;
  const { data: item } = await db.from("menu_items").select("image_path").eq("id", id).eq("restaurant_id", rid).maybeSingle();
  if (!item) return;
  const path = `${rid}/gerechten/${id}-${Date.now()}.jpg`;
  const { error } = await db.storage.from("zaak-media").upload(path, photo, { contentType: photo.type, upsert: false });
  if (error) return;
  await db.from("menu_items").update({ image_path: path }).eq("id", id);
  if (item.image_path) await db.storage.from("zaak-media").remove([item.image_path]);
  await done(rid);
}
async function removePhoto(f: FormData) {
  "use server";
  const db = await userDb();
  const { data: item } = await db.from("menu_items").select("image_path").eq("id", s(f, "id")).maybeSingle();
  await db.from("menu_items").update({ image_path: null }).eq("id", s(f, "id"));
  if (item?.image_path) await db.storage.from("zaak-media").remove([item.image_path]);
  await done(s(f, "rid"));
}
async function toggleItem(f: FormData) {
  "use server";
  const db = await userDb();
  await db.from("menu_items").update({ available: s(f, "available") === "1" }).eq("id", s(f, "id"));
  await done(s(f, "rid"));
}
async function deleteItem(f: FormData) {
  "use server";
  const db = await userDb();
  await db.from("menu_items").delete().eq("id", s(f, "id"));
  await done(s(f, "rid"));
}
// "Mayonaise +0,90, Andalouse +0,90, Geen saus" of één keuze per regel (dan mogen er komma's in de naam staan).
function parseChoices(txt: string) {
  return txt.split(txt.includes("\n") ? /\r?\n/ : ",").map((x) => x.trim()).filter(Boolean).slice(0, 30).map((x, i) => {
    const m = x.match(/^(.*?)(?:\s*\+\s*€?\s*([\d.,]+))?$/);
    return { name: (m?.[1] ?? x).trim().slice(0, 60), extra_cents: m?.[2] ? toCents(m[2]) ?? 0 : 0, position: i + 1 };
  }).filter((c) => c.name);
}
const maxOf = (f: FormData) => { const n = Math.round(Number(s(f, "max"))); return f.get("multi") === "on" && n >= 1 && n <= 30 ? n : null; };
async function addGroup(f: FormData) {
  "use server";
  const db = await userDb(); const rid = s(f, "rid");
  const choices = parseChoices(s(f, "choices"));
  if (!s(f, "name") || !choices.length) return;
  const owner = s(f, "cat") ? { category_id: s(f, "cat") } : { item_id: s(f, "item") };
  const { count } = await db.from("option_groups").select("id", { count: "exact", head: true }).match(owner);
  const { data: g } = await db.from("option_groups").insert({ restaurant_id: rid, ...owner, name: s(f, "name").slice(0, 40), multi: f.get("multi") === "on", required: f.get("required") === "on", max_select: maxOf(f), position: (count ?? 0) + 1 }).select("id").single();
  if (g) await db.from("option_choices").insert(choices.map((c) => ({ ...c, restaurant_id: rid, group_id: g.id })));
  await done(rid);
}
async function saveGroup(f: FormData) {
  "use server";
  const db = await userDb(); const rid = s(f, "rid"), id = s(f, "id");
  const choices = parseChoices(s(f, "choices"));
  if (!s(f, "name") || !choices.length) return;
  const { error } = await db.from("option_groups").update({ name: s(f, "name").slice(0, 40), multi: f.get("multi") === "on", required: f.get("required") === "on", max_select: maxOf(f) }).eq("id", id);
  if (error) return;
  await db.from("option_choices").delete().eq("group_id", id);
  await db.from("option_choices").insert(choices.map((c) => ({ ...c, restaurant_id: rid, group_id: id })));
  await done(rid);
}
// Meerdere gerechten tegelijk: "Naam; prijs; omschrijving" per regel.
async function bulkAdd(f: FormData) {
  "use server";
  const db = await userDb(); const rid = s(f, "rid"), cat = s(f, "cat");
  const rows = s(f, "lines").split(/\r?\n/).map((l) => l.split(/;|\t/).map((x) => x.trim())).filter((r) => r[0]).slice(0, 100);
  const { count } = await db.from("menu_items").select("id", { count: "exact", head: true }).eq("category_id", cat);
  const items = rows.map((r, i) => ({ restaurant_id: rid, category_id: cat, name: r[0].slice(0, 80), price_cents: toCents(r[1] ?? "") ?? 0, description: (r[2] ?? "").slice(0, 200) || null, position: (count ?? 0) + i + 1 }));
  if (items.length) await db.from("menu_items").insert(items);
  await done(rid);
}
async function bulkPrices(f: FormData) {
  "use server";
  const db = await userDb(); const rid = s(f, "rid");
  const updates = [...f.entries()].filter(([k]) => k.startsWith("p_")).map(([k, v]) => [k.slice(2), toCents(v)] as const).filter(([, c]) => c !== null);
  await Promise.all(updates.map(([id, c]) => db.from("menu_items").update({ price_cents: c! }).eq("id", id).eq("restaurant_id", rid)));
  await done(rid);
}
const choiceRow = (c: TChoice, i: number) => (typeof c === "string" ? { name: c, extra_cents: 0, position: i + 1 } : { name: c[0], extra_cents: c[1], position: i + 1 });
async function loadTemplate(f: FormData) {
  "use server";
  const db = await userDb(); const rid = s(f, "rid");
  const t = TEMPLATES.find((x) => x.key === s(f, "key"));
  if (!t) return;
  const { data: have } = await db.from("menu_categories").select("name").eq("restaurant_id", rid);
  const names = new Set((have ?? []).map((c) => c.name.toLowerCase()));
  // Al geladen (bv. twee keer geklikt)? Dan niets dubbel toevoegen.
  if (t.categories.some((c) => c.groups?.length && names.has(c.name.toLowerCase()))) redirect(`/beheer/menu?zaak=${s(f, "zaak")}&voorbeeld=al`);
  const count = have?.length ?? 0;
  for (const [ci, c] of t.categories.filter((c) => !names.has(c.name.toLowerCase())).entries()) {
    const { data: cat } = await db.from("menu_categories").insert({ restaurant_id: rid, name: c.name, position: count + ci + 1 }).select("id").single();
    if (!cat) continue;
    if (c.items.length) await db.from("menu_items").insert(c.items.map(([name, cents, description], i) => ({ restaurant_id: rid, category_id: cat.id, name, price_cents: cents, description: description ?? null, position: i + 1 })));
    for (const [gi, g] of (c.groups ?? []).entries()) {
      const { data: grp } = await db.from("option_groups").insert({ restaurant_id: rid, category_id: cat.id, name: g.name, multi: !!g.multi, required: !!g.required, max_select: g.max ?? null, position: gi + 1 }).select("id").single();
      if (grp) await db.from("option_choices").insert(g.choices.map((ch, i) => ({ ...choiceRow(ch, i), restaurant_id: rid, group_id: grp.id })));
    }
  }
  await done(rid);
  redirect(`/beheer/menu?zaak=${s(f, "zaak")}&voorbeeld=1`);
}
async function deleteGroup(f: FormData) {
  "use server";
  const db = await userDb();
  await db.from("option_groups").delete().eq("id", s(f, "id"));
  await done(s(f, "rid"));
}

export default async function Page({ searchParams }: { searchParams: Promise<{ zaak?: string; voorbeeld?: string }> }) {
  const sp = await searchParams;
  const { db, restaurants, current } = await panel(sp.zaak);
  if (!current) return null;
  const { data } = await db.from("menu_categories")
    .select("id, name, position, option_groups ( id, name, multi, required, max_select, position, option_choices ( id, name, extra_cents, position ) ), menu_items ( id, name, description, price_cents, available, position, image_path, option_groups ( id, name, multi, required, max_select, position, option_choices ( id, name, extra_cents, position ) ) )")
    .eq("restaurant_id", current.id).order("position");
  const cats = ((data ?? []) as unknown as Cat[]).map((c) => ({ ...c, option_groups: [...c.option_groups].sort((a, b) => a.position - b.position), menu_items: [...c.menu_items].sort((a, b) => a.position - b.position) }));
  const { data: rest } = await db.from("restaurants").select("type").eq("id", current.id).maybeSingle();
  const suggested = templateFor(rest?.type);
  const rid = current.id;
  const media = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zaak-media/`;
  const H = ({ n, v }: { n: string; v: string }) => <input type="hidden" name={n} value={v} />;
  const lines = (g: Group) => [...g.option_choices].sort((a, b) => a.position - b.position).map((x) => x.name + (x.extra_cents ? ` +${fromCents(x.extra_cents)}` : "")).join("\n");
  const flags = (g: Group) => [g.required ? "verplicht" : "optioneel", g.multi ? (g.max_select ? `max. ${g.max_select}` : "meerdere") : "één keuze"].join(" · ");
  const GroupFields = ({ g }: { g?: Group }) => (
    <>
      <label className="field">Naam groep<input name="name" defaultValue={g?.name} placeholder="bv. Broodsoort" required /></label>
      <label className="field" style={{ gridColumn: "1/-1" }}>Keuzes, één per regel (meerprijs met +)
        <textarea name="choices" rows={Math.min(10, Math.max(3, g?.option_choices.length ?? 3))} defaultValue={g ? lines(g) : ""} placeholder={"Wit\nBruin\nCiabatta +0,50"} required />
      </label>
      <label className="check"><input type="checkbox" name="required" defaultChecked={g?.required} /> Verplicht kiezen</label>
      <label className="check"><input type="checkbox" name="multi" defaultChecked={g?.multi} /> Meerdere keuzes</label>
      <label className="field" style={{ maxWidth: 160 }}>Max. aantal (bij meerdere)<input name="max" type="number" min={1} max={30} defaultValue={g?.max_select ?? ""} placeholder="geen" /></label>
    </>
  );
  const GroupList = ({ groups }: { groups: Group[] }) => (
    <>
      {groups.map((g) => (
        <details className="grp-edit" key={g.id}>
          <summary><span><b>{g.name}</b> <small className="muted">· {flags(g)}</small><br /><small>{[...g.option_choices].sort((a, b) => a.position - b.position).map((x) => x.name + (x.extra_cents ? ` +${fromCents(x.extra_cents)}` : "")).join(" · ")}</small></span><span className="btn btn-ghost small">Wijzigen</span></summary>
          <form action={saveGroup} className="fgrid" style={{ marginTop: 10 }}><H n="rid" v={rid} /><H n="id" v={g.id} /><GroupFields g={g} /><div><button className="btn btn-primary">Opslaan</button></div></form>
          <form action={deleteGroup} style={{ marginTop: 6 }}><H n="rid" v={rid} /><H n="id" v={g.id} /><button className="btn btn-ghost small">Groep verwijderen</button></form>
        </details>
      ))}
    </>
  );

  return (
    <>
      <PanelNav active="menu" restaurants={restaurants} current={current} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div><h1 className="ph">Menu</h1><p className="muted small" style={{ margin: 0 }}>Wijzigingen staan binnen een halve minuut op je bestelpagina.</p></div>
        <form action={addCategory} className="dayform"><H n="rid" v={rid} /><label className="field">Nieuwe categorie<input name="name" placeholder="bv. Sauzen" required /></label><button className="btn btn-primary">Toevoegen</button></form>
      </div>
      {sp.voorbeeld === "al" && <div className="alert">Dit voorbeeldmenu staat al in je menu.</div>}
      {sp.voorbeeld === "1" && <div className="okmsg">Voorbeeldmenu geladen. Pas nu je prijzen aan (per categorie: “Prijzen aanpassen”) en verwijder wat je niet verkoopt.</div>}
      <details className="panel tpl" open={!cats.length}>
        <summary><b>Snel starten met een voorbeeldmenu</b> <span className="muted small">· alles aanpasbaar</span></summary>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {TEMPLATES.map((t) => (
            <form key={t.key} action={loadTemplate} className="tpl-row"><H n="rid" v={rid} /><H n="key" v={t.key} /><H n="zaak" v={current.slug} />
              <div><b>{t.label}</b>{suggested?.key === t.key && <span className="pill ok" style={{ marginLeft: 6 }}>past bij jouw zaak</span>}<div className="muted small">{t.intro} {t.categories.reduce((n, c) => n + c.items.length, 0)} gerechten in {t.categories.length} categorieën.</div></div>
              <button className="btn btn-primary">Toevoegen aan mijn menu</button>
            </form>
          ))}
          <p className="muted small" style={{ margin: 0 }}>Het voorbeeld wordt bij je menu gevoegd; er wordt niets gewist. Prijzen zijn voorbeeldprijzen.</p>
        </div>
      </details>
      {cats.map((c, ci) => (
        <section className="panel mcat" key={c.id}>
          <div className="mcat-head">
            <form action={renameCategory} className="dayform" style={{ flex: 1 }}><H n="rid" v={rid} /><H n="id" v={c.id} /><input className="cat-name" name="name" defaultValue={c.name} aria-label="Naam categorie" /><button className="btn">Opslaan</button></form>
            <form action={moveCategory}><H n="rid" v={rid} /><H n="id" v={c.id} /><H n="dir" v="-1" /><button className="btn" disabled={ci === 0} aria-label="Omhoog">↑</button></form>
            <form action={moveCategory}><H n="rid" v={rid} /><H n="id" v={c.id} /><H n="dir" v="1" /><button className="btn" disabled={ci === cats.length - 1} aria-label="Omlaag">↓</button></form>
            <details className="confirm"><summary className="btn btn-ghost">Verwijderen</summary>
              <form action={deleteCategory} className="confirm-box"><H n="rid" v={rid} /><H n="id" v={c.id} /><span className="small">Categorie en alle {c.menu_items.length} gerechten erin verwijderen?</span><button className="btn btn-danger">Ja, verwijderen</button></form>
            </details>
          </div>
          <details className="catopts" open={c.option_groups.length > 0 && c.menu_items.length === 0}>
            <summary><b>Opties voor alle gerechten in “{c.name}”</b> <span className="muted small">· {c.option_groups.length ? c.option_groups.map((g) => g.name).join(", ") : "bv. broodsoort, formaat, smos, sauzen"}</span></summary>
            <div className="groups" style={{ marginTop: 8 }}>
              <p className="muted small" style={{ margin: 0 }}>Deze opties krijgt elk gerecht in deze categorie automatisch. Zo stel je broodsoort, formaat of sauzen maar één keer in.</p>
              <GroupList groups={c.option_groups} />
              <details><summary className="btn">+ Optiegroep voor de hele categorie</summary>
                <form action={addGroup} className="fgrid" style={{ marginTop: 10 }}><H n="rid" v={rid} /><H n="cat" v={c.id} /><GroupFields /><div><button className="btn btn-primary">Toevoegen</button></div></form>
              </details>
            </div>
          </details>
          <div className="mitems">
            {c.menu_items.map((i) => (
              <details className="mitem" key={i.id}>
                <summary>
                  <span className={i.available ? "" : "muted"} style={{ display: "flex", gap: 10, alignItems: "center" }}>{i.image_path && <img src={media + i.image_path} alt="" className="photo-thumb" /> /* eslint-disable-line @next/next/no-img-element */}<span><b>{i.name}</b>{i.option_groups.length > 0 && <small className="muted"> · {i.option_groups.map((g) => g.name).join(", ")}</small>}</span></span>
                  <span className="num">{eur(i.price_cents)}</span>
                  <form action={toggleItem}><H n="rid" v={rid} /><H n="id" v={i.id} /><H n="available" v={i.available ? "0" : "1"} />
                    <button className={`pill ${i.available ? "ok" : "wait"}`} style={{ border: 0, cursor: "pointer" }} title="Klik om te wisselen">{i.available ? "Beschikbaar" : "Uitverkocht"}</button></form>
                </summary>
                <div className="mitem-body">
                  <div className="photo-row">
                    {i.image_path
                      ? <img src={media + i.image_path} alt="" className="photo-prev" /> // eslint-disable-line @next/next/no-img-element
                      : <span className="photo-prev photo-empty">Geen foto</span>}
                    <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
                      <form action={savePhoto}><H n="rid" v={rid} /><H n="id" v={i.id} /><PhotoInput label={i.image_path ? "Andere foto" : "Foto toevoegen"} /></form>
                      {i.image_path && <form action={removePhoto}><H n="rid" v={rid} /><H n="id" v={i.id} /><button className="btn btn-ghost small">Foto verwijderen</button></form>}
                      <span className="muted small">Liggend werkt het best. Een foto van je telefoon is genoeg.</span>
                    </div>
                  </div>
                  <form action={saveItem} className="fgrid"><H n="rid" v={rid} /><H n="id" v={i.id} />
                    <label className="field">Naam<input name="name" defaultValue={i.name} required /></label>
                    <label className="field">Prijs (€)<input name="price" defaultValue={fromCents(i.price_cents)} inputMode="decimal" required /></label>
                    <label className="field">Categorie<select name="cat" defaultValue={c.id}>{cats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                    <label className="field" style={{ gridColumn: "1/-1" }}>Omschrijving<input name="description" defaultValue={i.description ?? ""} placeholder="optioneel" /></label>
                    <label className="check"><input type="checkbox" name="available" defaultChecked={i.available} /> Beschikbaar</label>
                    <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary">Opslaan</button></div>
                  </form>
                  <div className="groups">
                    <b className="small">Eigen opties van dit gerecht</b>
                    {c.option_groups.length > 0 && <span className="muted small">Ook de opties van de categorie gelden: {c.option_groups.map((g) => g.name).join(", ")}.</span>}
                    <GroupList groups={i.option_groups} />
                    <details><summary className="btn">+ Optiegroep</summary>
                      <form action={addGroup} className="fgrid" style={{ marginTop: 10 }}><H n="rid" v={rid} /><H n="item" v={i.id} /><GroupFields /><div><button className="btn btn-primary">Toevoegen</button></div></form>
                    </details>
                  </div>
                  <details className="confirm"><summary className="btn btn-ghost">Gerecht verwijderen</summary>
                    <form action={deleteItem} className="confirm-box"><H n="rid" v={rid} /><H n="id" v={i.id} /><span className="small">{i.name} verwijderen? Oude bestellingen blijven bewaard.</span><button className="btn btn-danger">Ja, verwijderen</button></form>
                  </details>
                </div>
              </details>
            ))}
          </div>
          <form action={addItem} className="fgrid additem"><H n="rid" v={rid} /><H n="cat" v={c.id} />
            <label className="field">Nieuw gerecht<input name="name" placeholder="Naam" required /></label>
            <label className="field">Prijs (€)<input name="price" placeholder="4,20" inputMode="decimal" required /></label>
            <label className="field">Omschrijving<input name="description" placeholder="optioneel" /></label>
            <div style={{ alignSelf: "end" }}><button className="btn btn-primary">Toevoegen</button></div>
          </form>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <details className="bulk"><summary className="btn">Meerdere gerechten tegelijk</summary>
              <form action={bulkAdd} style={{ display: "grid", gap: 8, marginTop: 10 }}><H n="rid" v={rid} /><H n="cat" v={c.id} />
                <label className="field">Eén gerecht per regel: naam; prijs; omschrijving (optioneel)
                  <textarea name="lines" rows={6} placeholder={"Kaas; 3,50\nHesp; 3,50\nMartino; 4,50; préparé, augurk, ui, martinosaus"} required /></label>
                <div><button className="btn btn-primary">Alles toevoegen</button></div>
              </form>
            </details>
            {c.menu_items.length > 1 && (
              <details className="bulk"><summary className="btn">Prijzen aanpassen</summary>
                <form action={bulkPrices} style={{ display: "grid", gap: 8, marginTop: 10 }}><H n="rid" v={rid} />
                  <div className="pricegrid">
                    {c.menu_items.map((i) => <label key={i.id} className="pricerow"><span>{i.name}</span><input name={`p_${i.id}`} defaultValue={fromCents(i.price_cents)} inputMode="decimal" aria-label={`Prijs ${i.name}`} /></label>)}
                  </div>
                  <div><button className="btn btn-primary">Prijzen opslaan</button></div>
                </form>
              </details>
            )}
          </div>
        </section>
      ))}
      {!cats.length && <div className="panel muted">Nog geen categorieën. Voeg er hierboven een toe, bv. Frieten.</div>}
    </>
  );
}
