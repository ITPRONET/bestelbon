"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Menu, Item, CartLine } from "@/lib/types";
import { eur } from "@/lib/money";
import { cleanPostcode, DAYS, findZone, openState, timeSlots, weekMinute, type HourRow } from "@/lib/hours";

type Line = CartLine & { key: string };

export default function Shop({ menu, storageUrl }: { menu: Menu; storageUrl: string }) {
  const { restaurant: r, categories, plan, hours, zones } = menu;
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
  // Opening hours are evaluated in the browser (the page itself is cached), and again on the server.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const tick = () => setNow(weekMinute()); tick(); const i = setInterval(tick, 30000); return () => clearInterval(i); }, []);
  const st = now === null ? null : openState(hours, now);
  const slots = now === null ? ["Zo snel mogelijk"] : timeSlots(hours, r.prep_minutes, now);
  useEffect(() => { if (slots.length && !slots.includes(f.time)) setF((x) => ({ ...x, time: slots[0] })); }, [slots.join(), f.time]); // eslint-disable-line react-hooks/exhaustive-deps
  const canOrder = r.is_open && slots.length > 0;

  const sub = cart.reduce((s, l) => s + unit(l) * l.qty, 0);
  const zone = zones.length ? findZone(zones, f.postcode) : undefined;
  const pcKnown = cleanPostcode(f.postcode).length === 4;
  const outZone = mode === "levering" && zones.length > 0 && pcKnown && !zone;
  const minOrder = zones.length ? (zone?.min_order_cents ?? Math.min(...zones.map((z) => z.min_order_cents))) : r.min_order_cents;
  const fee = mode === "levering" ? (zones.length ? (zone?.fee_cents ?? 0) : r.delivery_fee_cents) : 0;
  const tooLow = mode === "levering" && sub < minOrder;
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
            <p>{r.type}{r.city ? ` · ${r.city}` : ""} · levering vanaf {eur(minOrder)}</p>
            {st && !st.always && <p className={`openlbl ${st.open ? "on" : ""}`}>{st.label}</p>}
          </div>
          {hours.length > 0 && <HoursList hours={hours} />}
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
          {canOrder && !(slots.length === 1 && slots[0] === "Zo snel mogelijk") ? (
            <label className="field">{mode === "levering" ? "Leveren om" : "Afhalen om"}
              <select value={f.time} onChange={set("time")}>{slots.map((s) => <option key={s}>{s}</option>)}</select>
            </label>
          ) : null}
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
          {outZone && <p className="err" style={{ margin: 0 }}>We leveren niet in {cleanPostcode(f.postcode)}. Kies afhalen of bel de zaak.</p>}
          {zones.length > 0 && mode === "levering" && !pcKnown && <p className="muted" style={{ margin: 0, fontSize: 14 }}>We leveren in {zones.map((z) => z.postcode).join(", ")}.</p>}
          {tooLow && cart.length > 0 && !outZone && <p className="muted" style={{ margin: 0 }}>Minimum voor levering is {eur(minOrder)}.</p>}
          {!r.is_open && <p className="err" style={{ margin: 0 }}>Online bestellen is tijdelijk niet mogelijk.</p>}
          {r.is_open && st && !slots.length && <p className="err" style={{ margin: 0 }}>{st.label}. Je kunt bestellen zodra de zaak open is.</p>}
          {r.is_open && st && !st.open && st.preorder && <p className="muted" style={{ margin: 0, fontSize: 14 }}>De zaak is nog gesloten. Je kunt nu al bestellen voor later vandaag.</p>}
          {error && <p className="err" role="alert" style={{ margin: 0 }}>{error}</p>}
          <button className="btn btn-primary" disabled={!cart.length || tooLow || outZone || busy || !canOrder} onClick={order}>{busy ? "Bezig…" : "Bestelling plaatsen"}</button>
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

function HoursList({ hours }: { hours: HourRow[] }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <details className="hours">
      <summary>Openingsuren</summary>
      <table><tbody>{order.map((d) => {
        const rows = hours.filter((h) => h.weekday === d).sort((a, b) => a.opens.localeCompare(b.opens));
        return <tr key={d}><th>{DAYS[d]}</th><td>{rows.length ? rows.map((h) => `${h.opens.slice(0, 5)}–${h.closes.slice(0, 5)}`).join(", ") : "gesloten"}</td></tr>;
      })}</tbody></table>
    </details>
  );
}
