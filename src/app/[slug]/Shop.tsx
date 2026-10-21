"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Menu, Item, CartLine } from "@/lib/types";
import { eur } from "@/lib/money";

type Line = CartLine & { key: string };

export default function Shop({ menu, storageUrl }: { menu: Menu; storageUrl: string }) {
  const { restaurant: r, categories, plan } = menu;
  const router = useRouter();
  const items = useMemo(() => new Map(categories.flatMap((c) => c.menu_items).map((i) => [i.id, i])), [categories]);
  const [cart, setCart] = useState<Line[]>([]);
  const [picking, setPicking] = useState<Item | null>(null);
  const [mode, setMode] = useState<"levering" | "afhalen">("levering");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState({ name: "", phone: "", email: "", address: "", postcode: "", city: "", time: "Zo snel mogelijk", note: "" });

  const unit = (l: CartLine) => {
    const it = items.get(l.itemId)!;
    const extras = it.option_groups.flatMap((g) => g.option_choices).filter((c) => l.choiceIds.includes(c.id)).reduce((s, c) => s + c.extra_cents, 0);
    return it.price_cents + extras;
  };
  const sub = cart.reduce((s, l) => s + unit(l) * l.qty, 0);
  const fee = mode === "levering" ? r.delivery_fee_cents : 0;
  const tooLow = mode === "levering" && sub < r.min_order_cents;
  const brand = plan === "pro" ? { "--brand": r.brand_primary, "--accent": r.brand_accent } : {};

  function add(it: Item, choiceIds: string[]) {
    const key = it.id + "|" + [...choiceIds].sort().join(",");
    setCart((c) => {
      const ex = c.find((l) => l.key === key);
      return ex ? c.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)) : [...c, { key, itemId: it.id, choiceIds, qty: 1 }];
    });
  }
  function change(key: string, d: number) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0));
  }
  async function order() {
    setBusy(true); setError("");
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: r.slug, mode, payment: "cash", ...f, lines: cart.map(({ itemId, choiceIds, qty }) => ({ itemId, choiceIds, qty })) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Er ging iets mis. Probeer opnieuw."); setBusy(false); return; }
    router.push(`/${r.slug}/bestelling/${data.id}`);
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div style={brand as React.CSSProperties}>
      <header className="shop-head">
        <div className="wrap">
          {plan === "pro" && r.logo_path ? <img src={storageUrl + r.logo_path} alt={`Logo ${r.name}`} /> : <div className="mono">{r.name[0]}</div>}
          <div>
            <h1>{r.name}</h1>
            <p>{r.type}{r.city ? ` · ${r.city}` : ""} · levering vanaf {eur(r.min_order_cents)}</p>
          </div>
        </div>
      </header>
      <main className="wrap shop-grid">
        <div>
          {categories.map((c) => (
            <section className="cat" key={c.id}>
              <h2>{c.name}</h2>
              <div className="items">
                {c.menu_items.map((i) => (
                  <div className={`item ${i.available ? "" : "off"}`} key={i.id}>
                    <div className="t"><b>{i.name}</b>{i.description && <small>{i.description}</small>}{!i.available && <small>Tijdelijk niet beschikbaar</small>}</div>
                    <span className="num">{eur(i.price_cents)}</span>
                    {i.available && <button className="add" aria-label={`${i.name} toevoegen`} onClick={() => (i.option_groups.length ? setPicking(i) : add(i, []))}>+</button>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="panel cart">
          <h2 style={{ margin: 0, fontSize: 19 }}>Je bestelling</h2>
          {cart.length ? cart.map((l) => {
            const it = items.get(l.itemId)!;
            const names = it.option_groups.flatMap((g) => g.option_choices).filter((c) => l.choiceIds.includes(c.id)).map((c) => c.name);
            return (
              <div className="line" key={l.key}>
                <div className="qty"><button aria-label="Minder" onClick={() => change(l.key, -1)}>−</button><span className="num">{l.qty}</span><button aria-label="Meer" onClick={() => change(l.key, 1)}>+</button></div>
                <div className="n">{it.name}{names.length > 0 && <small>{names.join(", ")}</small>}</div>
                <span className="num">{eur(unit(l) * l.qty)}</span>
              </div>
            );
          }) : <p className="muted" style={{ margin: 0 }}>Nog niets gekozen. Tik op + bij een gerecht.</p>}
          <div className="seg">
            <button aria-pressed={mode === "levering"} onClick={() => setMode("levering")}>Levering</button>
            <button aria-pressed={mode === "afhalen"} onClick={() => setMode("afhalen")}>Afhalen</button>
          </div>
          <label className="field">Naam<input value={f.name} onChange={set("name")} autoComplete="name" /></label>
          <label className="field">Telefoon<input value={f.phone} onChange={set("phone")} type="tel" autoComplete="tel" /></label>
          <label className="field">E-mail<input value={f.email} onChange={set("email")} type="email" autoComplete="email" /></label>
          {mode === "levering" && <>
            <label className="field">Adres<input value={f.address} onChange={set("address")} autoComplete="street-address" /></label>
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8 }}>
              <label className="field">Postcode<input value={f.postcode} onChange={set("postcode")} inputMode="numeric" autoComplete="postal-code" /></label>
              <label className="field">Gemeente<input value={f.city} onChange={set("city")} autoComplete="address-level2" /></label>
            </div>
          </>}
          <label className="field">Opmerking<input value={f.note} onChange={set("note")} placeholder="bv. bel aan bij nr. 2" /></label>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>Betalen bij {mode === "levering" ? "levering" : "afhaling"}.</p>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }} className="muted"><span>Subtotaal</span><span className="num">{eur(sub)}</span></div>
          {mode === "levering" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }} className="muted"><span>Leverkost</span><span className="num">{eur(fee)}</span></div>}
          <div className="total"><span>Totaal</span><span className="num">{eur(sub + fee)}</span></div>
          {tooLow && cart.length > 0 && <p className="muted" style={{ margin: 0 }}>Minimum voor levering is {eur(r.min_order_cents)}.</p>}
          {!r.is_open && <p className="err" style={{ margin: 0 }}>Online bestellen is tijdelijk niet mogelijk.</p>}
          {error && <p className="err" role="alert" style={{ margin: 0 }}>{error}</p>}
          <button className="btn btn-primary" disabled={!cart.length || tooLow || busy || !r.is_open} onClick={order}>{busy ? "Bezig…" : "Bestelling plaatsen"}</button>
        </aside>
      </main>
      {picking && <Options item={picking} onClose={() => setPicking(null)} onAdd={(ids) => { add(picking, ids); setPicking(null); }} />}
    </div>
  );
}

function Options({ item, onClose, onAdd }: { item: Item; onClose: () => void; onAdd: (ids: string[]) => void }) {
  const [sel, setSel] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(item.option_groups.map((g) => [g.id, !g.multi && g.required && g.option_choices[0] ? [g.option_choices[0].id] : []])));
  return (
    <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label={`Opties ${item.name}`}>
        <h3 style={{ marginTop: 0 }}>{item.name}</h3>
        {item.option_groups.map((g) => (
          <fieldset key={g.id}>
            <legend><b>{g.name}</b>{g.multi ? " (meerdere mogelijk)" : ""}</legend>
            {g.option_choices.map((c) => (
              <label key={c.id}>
                <input type={g.multi ? "checkbox" : "radio"} name={g.id} checked={sel[g.id]?.includes(c.id) ?? false}
                  onChange={(e) => setSel({ ...sel, [g.id]: g.multi ? (e.target.checked ? [...sel[g.id], c.id] : sel[g.id].filter((x) => x !== c.id)) : [c.id] })} />
                <span>{c.name}</span>{c.extra_cents > 0 && <span className="num">+{eur(c.extra_cents)}</span>}
              </label>
            ))}
          </fieldset>
        ))}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Annuleren</button>
          <button className="btn btn-primary" onClick={() => onAdd(Object.values(sel).flat())}>Toevoegen</button>
        </div>
      </div>
    </div>
  );
}
