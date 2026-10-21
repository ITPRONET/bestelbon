import { revalidatePath } from "next/cache";
import PanelNav from "@/components/PanelNav";
import { panel } from "@/lib/panel";
import { userDb } from "@/lib/supabase-server";
import { eur } from "@/lib/money";
import { toCents, fromCents } from "@/lib/euro";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu" };

type Choice = { id: string; name: string; extra_cents: number; position: number };
type Group = { id: string; name: string; multi: boolean; required: boolean; position: number; option_choices: Choice[] };
type Item = { id: string; name: string; description: string | null; price_cents: number; available: boolean; position: number; option_groups: Group[] };
type Cat = { id: string; name: string; position: number; menu_items: Item[] };

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
// "Mayonaise +0,90, Andalouse +0,90, Geen saus"
function parseChoices(txt: string) {
  return txt.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 30).map((x, i) => {
    const m = x.match(/^(.*?)(?:\s*\+\s*€?\s*([\d.,]+))?$/);
    return { name: (m?.[1] ?? x).trim().slice(0, 60), extra_cents: m?.[2] ? toCents(m[2]) ?? 0 : 0, position: i + 1 };
  }).filter((c) => c.name);
}
async function addGroup(f: FormData) {
  "use server";
  const db = await userDb(); const rid = s(f, "rid");
  const choices = parseChoices(s(f, "choices"));
  if (!s(f, "name") || !choices.length) return;
  const { data: g } = await db.from("option_groups").insert({ restaurant_id: rid, item_id: s(f, "item"), name: s(f, "name").slice(0, 40), multi: f.get("multi") === "on", required: f.get("required") === "on" }).select("id").single();
  if (g) await db.from("option_choices").insert(choices.map((c) => ({ ...c, restaurant_id: rid, group_id: g.id })));
  await done(rid);
}
async function deleteGroup(f: FormData) {
  "use server";
  const db = await userDb();
  await db.from("option_groups").delete().eq("id", s(f, "id"));
  await done(s(f, "rid"));
}

export default async function Page({ searchParams }: { searchParams: Promise<{ zaak?: string }> }) {
  const sp = await searchParams;
  const { db, restaurants, current } = await panel(sp.zaak);
  if (!current) return null;
  const { data } = await db.from("menu_categories")
    .select("id, name, position, menu_items ( id, name, description, price_cents, available, position, option_groups ( id, name, multi, required, position, option_choices ( id, name, extra_cents, position ) ) )")
    .eq("restaurant_id", current.id).order("position");
  const cats = ((data ?? []) as unknown as Cat[]).map((c) => ({ ...c, menu_items: [...c.menu_items].sort((a, b) => a.position - b.position) }));
  const rid = current.id;
  const H = ({ n, v }: { n: string; v: string }) => <input type="hidden" name={n} value={v} />;

  return (
    <>
      <PanelNav active="menu" restaurants={restaurants} current={current} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div><h1 className="ph">Menu</h1><p className="muted small" style={{ margin: 0 }}>Wijzigingen staan binnen een halve minuut op je bestelpagina.</p></div>
        <form action={addCategory} className="dayform"><H n="rid" v={rid} /><label className="field">Nieuwe categorie<input name="name" placeholder="bv. Sauzen" required /></label><button className="btn btn-primary">Toevoegen</button></form>
      </div>
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
          <div className="mitems">
            {c.menu_items.map((i) => (
              <details className="mitem" key={i.id}>
                <summary>
                  <span className={i.available ? "" : "muted"}><b>{i.name}</b>{i.option_groups.length > 0 && <small className="muted"> · {i.option_groups.map((g) => g.name).join(", ")}</small>}</span>
                  <span className="num">{eur(i.price_cents)}</span>
                  <form action={toggleItem}><H n="rid" v={rid} /><H n="id" v={i.id} /><H n="available" v={i.available ? "0" : "1"} />
                    <button className={`pill ${i.available ? "ok" : "wait"}`} style={{ border: 0, cursor: "pointer" }} title="Klik om te wisselen">{i.available ? "Beschikbaar" : "Uitverkocht"}</button></form>
                </summary>
                <div className="mitem-body">
                  <form action={saveItem} className="fgrid"><H n="rid" v={rid} /><H n="id" v={i.id} />
                    <label className="field">Naam<input name="name" defaultValue={i.name} required /></label>
                    <label className="field">Prijs (€)<input name="price" defaultValue={fromCents(i.price_cents)} inputMode="decimal" required /></label>
                    <label className="field">Categorie<select name="cat" defaultValue={c.id}>{cats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                    <label className="field" style={{ gridColumn: "1/-1" }}>Omschrijving<input name="description" defaultValue={i.description ?? ""} placeholder="optioneel" /></label>
                    <label className="check"><input type="checkbox" name="available" defaultChecked={i.available} /> Beschikbaar</label>
                    <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary">Opslaan</button></div>
                  </form>
                  <div className="groups">
                    <b className="small">Opties</b>
                    {i.option_groups.map((g) => (
                      <div className="grp" key={g.id}>
                        <span><b>{g.name}</b>{g.required ? " · verplicht" : ""}{g.multi ? " · meerdere" : ""}: {[...g.option_choices].sort((a, b) => a.position - b.position).map((x) => x.name + (x.extra_cents ? ` +${fromCents(x.extra_cents)}` : "")).join(", ")}</span>
                        <form action={deleteGroup}><H n="rid" v={rid} /><H n="id" v={g.id} /><button className="btn btn-ghost small">Verwijderen</button></form>
                      </div>
                    ))}
                    <form action={addGroup} className="fgrid"><H n="rid" v={rid} /><H n="item" v={i.id} />
                      <label className="field">Naam groep<input name="name" placeholder="Saus" /></label>
                      <label className="field" style={{ gridColumn: "span 2" }}>Keuzes<input name="choices" placeholder="Mayonaise +0,90, Andalouse +0,90, Geen saus" /></label>
                      <label className="check"><input type="checkbox" name="required" /> Verplicht kiezen</label>
                      <label className="check"><input type="checkbox" name="multi" /> Meerdere keuzes</label>
                      <div><button className="btn">Optiegroep toevoegen</button></div>
                    </form>
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
        </section>
      ))}
      {!cats.length && <div className="panel muted">Nog geen categorieën. Voeg er hierboven een toe, bv. Frieten.</div>}
    </>
  );
}
