"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Menu, Item, CartLine } from "@/lib/types";
import { eur } from "@/lib/money";
import { cleanPostcode, DAYS, findZone, openState, timeSlots, weekMinute, type HourRow } from "@/lib/hours";

type Line = CartLine & { key: string };
type Mode = "levering" | "afhalen";
type Sheet = null | { kind: "item"; item: Item } | { kind: "checkout" } | { kind: "info" };
const SAVED = "bb_klant";

export default function Shop({ menu, storageUrl }: { menu: Menu; storageUrl: string }) {
  const { restaurant: r, categories: allCats, plan, hours, zones, trader, online } = menu;
  const categories = useMemo(() => allCats.filter((c) => c.menu_items.length), [allCats]);
  const router = useRouter();
  const items = useMemo(() => new Map(categories.flatMap((c) => c.menu_items).map((i) => [i.id, i])), [categories]);
  const [cart, setCart] = useState<Line[]>([]);
  const [mode, setMode] = useState<Mode>("levering");
  const [pay, setPay] = useState<"online" | "cash">(online ? "online" : "cash");
  const CART_KEY = `bb_cart_${r.slug}`;
  const [sheet, setSheetState] = useState<Sheet>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState({ name: "", phone: "", email: "", address: "", postcode: "", city: "", time: "Zo snel mogelijk", note: "" });

  // Coming from the BestelBon-gids: "?modus=afhalen" preselects pickup; the postcode from the guide prefills delivery.
  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("modus") === "afhalen") setMode("afhalen");
      const pc = localStorage.getItem("bb_pc");
      if (pc && /^\d{4}$/.test(pc)) setF((x) => (x.postcode ? x : { ...x, postcode: pc }));
    } catch { /* ignore */ }
  }, []);

  // Back from a cancelled online payment: restore the cart.
  useEffect(() => {
    try { const c = JSON.parse(sessionStorage.getItem(CART_KEY) ?? "null"); if (Array.isArray(c) && c.length) setCart(c); sessionStorage.removeItem(CART_KEY); } catch { /* ignore */ }
  }, [CART_KEY]);

  // Remember the customer's details on this device (convenience only).
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(SAVED) ?? "null"); if (s) setF((x) => ({ ...x, ...s, time: x.time, note: "" })); } catch { /* ignore */ }
  }, []);

  // Sheets: the phone's back button closes them instead of leaving the page.
  const setSheet = useCallback((s: Sheet) => {
    setSheetState((prev) => {
      if (s && !prev) history.pushState({ bbSheet: 1 }, "");
      if (!s && prev && history.state?.bbSheet) history.back();
      return s;
    });
  }, []);
  useEffect(() => {
    const onPop = () => setSheetState(null);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => { document.body.style.overflow = sheet ? "hidden" : ""; }, [sheet]);

  const unit = (l: CartLine) => {
    const it = items.get(l.itemId)!;
    return it.price_cents + it.option_groups.flatMap((g) => g.option_choices).filter((c) => l.choiceIds.includes(c.id)).reduce((s, c) => s + c.extra_cents, 0);
  };

  // Opening hours are evaluated in the browser (the page is cached), and again on the server.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const tick = () => setNow(weekMinute()); tick(); const i = setInterval(tick, 30000); return () => clearInterval(i); }, []);
  const st = now === null ? null : openState(hours, now);
  const slots = now === null ? ["Zo snel mogelijk"] : timeSlots(hours, r.prep_minutes, now);
  useEffect(() => { if (slots.length && !slots.includes(f.time)) setF((x) => ({ ...x, time: slots[0] })); }, [slots.join(), f.time]); // eslint-disable-line react-hooks/exhaustive-deps
  const canOrder = r.is_open && slots.length > 0;

  const count = cart.reduce((s, l) => s + l.qty, 0);
  const sub = cart.reduce((s, l) => s + unit(l) * l.qty, 0);
  const zone = zones.length ? findZone(zones, f.postcode) : undefined;
  const pcKnown = cleanPostcode(f.postcode).length === 4;
  const outZone = mode === "levering" && zones.length > 0 && pcKnown && !zone;
  const minOrder = zones.length ? (zone?.min_order_cents ?? Math.min(...zones.map((z) => z.min_order_cents))) : r.min_order_cents;
  const fee = mode === "levering" ? (zones.length ? (zone?.fee_cents ?? 0) : r.delivery_fee_cents) : 0;
  const short = mode === "levering" ? Math.max(0, minOrder - sub) : 0;
  const inCart = (id: string) => cart.filter((l) => l.itemId === id).reduce((s, l) => s + l.qty, 0);
  const brand = plan === "pro" ? { "--brand": r.brand_primary, "--accent": r.brand_accent } : {};

  function add(it: Item, choiceIds: string[], qty = 1) {
    const key = it.id + "|" + [...choiceIds].sort().join(",");
    setCart((c) => {
      const ex = c.find((l) => l.key === key);
      return ex ? c.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l)) : [...c, { key, itemId: it.id, choiceIds, qty }];
    });
    setToast(`${qty > 1 ? qty + " × " : ""}${it.name} toegevoegd`);
  }
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1600); return () => clearTimeout(t); }, [toast]);
  const change = (key: string, d: number) => setCart((c) => c.map((l) => (l.key === key ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0));
  const tapItem = (i: Item) => { if (!i.available) return; if (i.option_groups.length) setSheet({ kind: "item", item: i }); else add(i, []); };

  async function order() {
    setBusy(true); setError("");
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: r.slug, mode, payment: online ? pay : "cash", ...f, lines: cart.map(({ itemId, choiceIds, qty }) => ({ itemId, choiceIds, qty })) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Er ging iets mis. Probeer opnieuw."); setBusy(false); return; }
    try { const { name, phone, email, address, postcode, city } = f; localStorage.setItem(SAVED, JSON.stringify({ name, phone, email, address, postcode, city })); } catch { /* ignore */ }
    if (data.checkoutUrl) {
      try { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ignore */ }
      window.location.href = data.checkoutUrl; // naar Mollie; daarna terug naar de statuspagina
      return;
    }
    setSheetState(null);
    router.replace(`/${r.slug}/bestelling/${data.id}`);
  }

  /* ---------- category navigation with scroll-spy ---------- */
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const navRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id.slice(4));
    }, { rootMargin: "-120px 0px -60% 0px" });
    categories.forEach((c) => { const el = document.getElementById("cat-" + c.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [categories]);
  useEffect(() => { navRef.current?.querySelector<HTMLElement>(`[data-id="${active}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }, [active]);
  const jump = (id: string) => {
    const el = document.getElementById("cat-" + id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 110, behavior: "smooth" });
  };

  const eta = mode === "levering" ? r.prep_minutes + 15 : r.prep_minutes;
  const shopAddr = [r.street, `${r.postcode ?? ""} ${r.city ?? ""}`.trim()].filter(Boolean).join(", ");

  return (
    <div className="s-root" style={brand as React.CSSProperties}>
      <header className="s-head">
        <div className="wrap s-head-in">
          {plan === "pro" && r.logo_path
            ? <img className="s-logo" src={storageUrl + r.logo_path} alt="" /> // eslint-disable-line @next/next/no-img-element
            : <div className="s-logo s-mono" aria-hidden="true">{r.name[0]}</div>}
          <div className="s-title">
            <h1>{r.name}</h1>
            <p>{r.type}{r.city ? ` · ${r.city}` : ""}</p>
          </div>
          <button className="s-info-btn" onClick={() => setSheet({ kind: "info" })} aria-label="Info en openingsuren">i</button>
        </div>
      </header>

      <div className="wrap">
        <div className="s-card s-mode">
          <div className="s-seg" role="tablist" aria-label="Levering of afhalen">
            <button role="tab" aria-selected={mode === "levering"} onClick={() => setMode("levering")}>Levering</button>
            <button role="tab" aria-selected={mode === "afhalen"} onClick={() => setMode("afhalen")}>Afhalen</button>
          </div>
          <div className="s-meta">
            {st && !st.always && <span className={`s-open ${st.open ? "on" : ""}`}>{st.label}</span>}
            <span>± {eta} min</span>
            {mode === "levering" ? <span>min. {eur(minOrder)}{!zones.length && r.delivery_fee_cents ? ` · leverkost ${eur(r.delivery_fee_cents)}` : ""}</span> : shopAddr && <span>{shopAddr}</span>}
          </div>
          {!r.is_open && <p className="s-closed">Online bestellen is tijdelijk niet mogelijk. Bel de zaak rechtstreeks.</p>}
          {r.is_open && st && !slots.length && <p className="s-closed">{st.label}. Je kunt bestellen zodra de zaak open is.</p>}
          {r.is_open && st && !st.open && st.preorder && <p className="s-pre">Nog gesloten. Je kunt nu al bestellen voor later vandaag.</p>}
        </div>
      </div>

      {categories.length > 1 && (
        <nav className="s-nav" aria-label="Categorieën">
          <div className="wrap s-nav-in" ref={navRef}>
            {categories.map((c) => (
              <button key={c.id} data-id={c.id} aria-current={active === c.id ? "true" : undefined} onClick={() => jump(c.id)}>{c.name}</button>
            ))}
          </div>
        </nav>
      )}

      <main className="wrap s-grid">
        <div className="s-menu">
          {categories.map((c) => (
            <section className="s-cat" id={"cat-" + c.id} key={c.id}>
              <h2>{c.name}</h2>
              <div className="s-items">
                {c.menu_items.map((i) => {
                  const n = inCart(i.id);
                  const extraFrom = i.option_groups.some((g) => g.required && g.option_choices.every((ch) => ch.extra_cents > 0));
                  return (
                    <button className={`s-item ${i.available ? "" : "off"} ${n ? "has" : ""}`} key={i.id} onClick={() => tapItem(i)} disabled={!i.available}
                      aria-label={`${i.name}, ${eur(i.price_cents)}${n ? `, ${n} in je bestelling` : ""}`}>
                      <span className="s-item-t">
                        <b>{n > 0 && <span className="s-n">{n}×</span>}{i.name}</b>
                        {i.description && <small>{i.description}</small>}
                        <span className="s-price">{extraFrom ? "vanaf " : ""}{eur(i.price_cents)}{!i.available && <em> · uitverkocht</em>}</span>
                      </span>
                      {i.image_path
                        ? <span className="s-img"><img src={storageUrl + i.image_path} alt="" loading="lazy" />{i.available && <span className="s-plus" aria-hidden="true">+</span>}</span> // eslint-disable-line @next/next/no-img-element
                        : i.available && <span className="s-plus" aria-hidden="true">+</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <footer className="s-foot"><span>Bestellen via BestelBon</span><Link href="/privacy">Privacy</Link></footer>
        </div>

        {/* Desktop: cart beside the menu */}
        <aside className="s-side s-card">
          <h2>Je bestelling</h2>
          {cart.length ? <CartLines cart={cart} items={items} unit={unit} change={change} /> : <p className="muted" style={{ margin: 0 }}>Nog niets gekozen. Tik op een gerecht om het toe te voegen.</p>}
          {cart.length > 0 && <>
            <div className="s-row s-strong"><span>Subtotaal</span><span className="num">{eur(sub)}</span></div>
            {short > 0 && <MinBar short={short} min={minOrder} sub={sub} />}
            <button className="s-cta" disabled={!canOrder} onClick={() => setSheet({ kind: "checkout" })}>Afrekenen · {eur(sub)}</button>
          </>}
        </aside>
      </main>

      {/* Phone: sticky bar at the bottom */}
      {count > 0 && !sheet && (
        <div className="s-bar">
          <button className="s-cta" onClick={() => setSheet({ kind: "checkout" })}>
            <span className="s-count">{count}</span><span>Bekijk bestelling</span><span className="num">{eur(sub)}</span>
          </button>
        </div>
      )}

      <div className={`s-toast ${toast ? "on" : ""}`} role="status" aria-live="polite">{toast}</div>

      {sheet?.kind === "item" && <ItemSheet item={sheet.item} storageUrl={storageUrl} onClose={() => setSheet(null)} onAdd={(ids, q) => { add(sheet.item, ids, q); setSheet(null); }} />}
      {sheet?.kind === "info" && (
        <SheetFrame title={r.name} onClose={() => setSheet(null)}>
          <div className="s-info">
            {shopAddr && <p><b>Adres</b><br /><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ", " + shopAddr)}`} target="_blank" rel="noopener">{shopAddr}</a></p>}
            <p><b>Levering</b><br />Minimum {eur(minOrder)}{zones.length ? ` · we leveren in ${zones.map((z) => z.postcode).join(", ")}` : r.delivery_fee_cents ? ` · leverkost ${eur(r.delivery_fee_cents)}` : " · gratis levering"}</p>
            {hours.length > 0 && <HoursTable hours={hours} today={now === null ? -1 : Math.floor(now / 1440)} />}
            {trader && (
              <p className="small"><b>Verkoper</b><br />{trader.legal_name}<br />{[trader.street, [trader.postcode, trader.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}{trader.street || trader.city ? <br /> : null}Btw {trader.vat_number}
                {trader.email && <><br /><a href={`mailto:${trader.email}`}>{trader.email}</a></>}{trader.phone && <><br /><a href={`tel:${trader.phone.replace(/\s/g, "")}`}>{trader.phone}</a></>}</p>
            )}
            <p className="muted small">{online ? "Online betalen of betalen bij levering of afhaling." : "Betalen bij levering of afhaling."} Je koopt rechtstreeks bij deze zaak; BestelBon levert enkel de bestelsoftware. <Link href="/privacy">Privacy</Link></p>
          </div>
        </SheetFrame>
      )}
      {sheet?.kind === "checkout" && (
        <SheetFrame title="Je bestelling" onClose={() => setSheet(null)} full
          footer={
            <>
              {error && <p className="err" role="alert" style={{ margin: "0 0 8px" }}>{error}</p>}
              <button className="s-cta" disabled={!cart.length || short > 0 || outZone || busy || !canOrder} onClick={order}>
                {busy ? "Bezig…" : !canOrder ? "Nu gesloten" : short > 0 ? `Nog ${eur(short)} tot het minimum` : online && pay === "online" ? `Bestellen en betalen · ${eur(sub + fee)}` : `Bestelling plaatsen · ${eur(sub + fee)}`}
              </button>
            </>
          }>
          <div className="s-check">
            {cart.length ? <CartLines cart={cart} items={items} unit={unit} change={change} /> : <p className="muted">Je bestelling is leeg.</p>}
            <button className="s-link" onClick={() => setSheet(null)}>+ Nog iets toevoegen</button>

            <div className="s-seg">
              <button aria-selected={mode === "levering"} onClick={() => setMode("levering")}>Levering</button>
              <button aria-selected={mode === "afhalen"} onClick={() => setMode("afhalen")}>Afhalen</button>
            </div>
            {canOrder && !(slots.length === 1 && slots[0] === "Zo snel mogelijk") && (
              <label className="s-field">{mode === "levering" ? "Wanneer leveren?" : "Wanneer afhalen?"}
                <select value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })}>{slots.map((s) => <option key={s}>{s}</option>)}</select>
              </label>
            )}

            <h3>Je gegevens</h3>
            <Field label="Naam" value={f.name} onChange={(v) => setF({ ...f, name: v })} autoComplete="name" />
            <Field label="Telefoon" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} type="tel" autoComplete="tel" inputMode="tel" />
            <Field label="E-mail" hint="voor je bevestiging" value={f.email} onChange={(v) => setF({ ...f, email: v })} type="email" autoComplete="email" inputMode="email" />
            {mode === "levering" && <>
              <Field label="Straat en huisnummer" value={f.address} onChange={(v) => setF({ ...f, address: v })} autoComplete="street-address" />
              <div className="s-two">
                <Field label="Postcode" value={f.postcode} onChange={(v) => setF({ ...f, postcode: v })} autoComplete="postal-code" inputMode="numeric" />
                <Field label="Gemeente" value={f.city} onChange={(v) => setF({ ...f, city: v })} autoComplete="address-level2" />
              </div>
              {outZone && <p className="err" style={{ margin: 0 }}>We leveren niet in {cleanPostcode(f.postcode)}. Kies afhalen of bel de zaak.</p>}
              {zones.length > 0 && !pcKnown && <p className="muted small" style={{ margin: 0 }}>We leveren in {zones.map((z) => z.postcode).join(", ")}.</p>}
            </>}
            <Field label="Opmerking" hint="optioneel" value={f.note} onChange={(v) => setF({ ...f, note: v })} placeholder={mode === "levering" ? "bv. bel aan bij nr. 2" : "bv. extra servetten"} />

            {online && <>
              <h3>Betalen</h3>
              <div className="s-seg">
                <button aria-selected={pay === "online"} onClick={() => setPay("online")}>Online betalen</button>
                <button aria-selected={pay === "cash"} onClick={() => setPay("cash")}>{mode === "levering" ? "Bij levering" : "Bij afhaling"}</button>
              </div>
              {pay === "online" && <p className="muted small" style={{ margin: 0 }}>Bancontact, Payconiq, kaart of Apple Pay via Mollie. Je betaalt rechtstreeks aan {r.name}.</p>}
            </>}

            <div className="s-sum">
              <div className="s-row"><span>Subtotaal</span><span className="num">{eur(sub)}</span></div>
              {mode === "levering" && <div className="s-row"><span>Leverkost</span><span className="num">{fee ? eur(fee) : "gratis"}</span></div>}
              <div className="s-row s-total"><span>Totaal</span><span className="num">{eur(sub + fee)}</span></div>
              {short > 0 && <MinBar short={short} min={minOrder} sub={sub} />}
              <p className="muted small" style={{ margin: 0 }}>{online && pay === "online" ? "Je bestelling gaat naar de zaak zodra je betaling gelukt is." : `Je betaalt bij ${mode === "levering" ? "levering" : "afhaling"}.`} Je gegevens dienen alleen voor deze bestelling en worden na 30 dagen gewist.</p>
            </div>
          </div>
        </SheetFrame>
      )}
    </div>
  );
}

/* ---------- pieces ---------- */

function CartLines({ cart, items, unit, change }: { cart: Line[]; items: Map<string, Item>; unit: (l: CartLine) => number; change: (k: string, d: number) => void }) {
  return (
    <ul className="s-lines">
      {cart.map((l) => {
        const it = items.get(l.itemId)!;
        const names = it.option_groups.flatMap((g) => g.option_choices).filter((c) => l.choiceIds.includes(c.id)).map((c) => c.name);
        return (
          <li key={l.key}>
            <div className="s-lt"><b>{it.name}</b>{names.length > 0 && <small>{names.join(", ")}</small>}<span className="num">{eur(unit(l) * l.qty)}</span></div>
            <div className="s-step">
              <button aria-label={l.qty === 1 ? `${it.name} verwijderen` : `Eén ${it.name} minder`} onClick={() => change(l.key, -1)}>{l.qty === 1 ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg> : "−"}</button>
              <span className="num" aria-live="polite">{l.qty}</span>
              <button aria-label={`Eén ${it.name} meer`} onClick={() => change(l.key, 1)}>+</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MinBar({ short, min, sub }: { short: number; min: number; sub: number }) {
  return (
    <div className="s-min">
      <div className="s-min-bar"><i style={{ width: `${Math.min(100, (sub / Math.max(min, 1)) * 100)}%` }} /></div>
      <small>Nog {eur(short)} tot het minimum voor levering ({eur(min)})</small>
    </div>
  );
}

function Field({ label, hint, value, onChange, ...rest }: { label: string; hint?: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="s-field">
      <span>{label}{hint && <em> · {hint}</em>}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </label>
  );
}

function SheetFrame({ title, onClose, children, footer, full }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; full?: boolean }) {
  return (
    <div className="s-sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`s-sheet ${full ? "full" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="s-sheet-head"><h2>{title}</h2><button className="s-x" onClick={onClose} aria-label="Sluiten">✕</button></div>
        <div className="s-sheet-body">{children}</div>
        {footer && <div className="s-sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

function ItemSheet({ item, storageUrl, onClose, onAdd }: { item: Item; storageUrl: string; onClose: () => void; onAdd: (ids: string[], qty: number) => void }) {
  const [sel, setSel] = useState<Record<string, string[]>>(() => Object.fromEntries(item.option_groups.map((g) => [g.id, []])));
  const [qty, setQty] = useState(1);
  const missing = item.option_groups.filter((g) => g.required && !sel[g.id]?.length);
  const chosen = Object.values(sel).flat();
  const extra = item.option_groups.flatMap((g) => g.option_choices).filter((c) => chosen.includes(c.id)).reduce((s, c) => s + c.extra_cents, 0);
  const toggle = (gid: string, cid: string, multi: boolean) =>
    setSel((s) => ({ ...s, [gid]: multi ? (s[gid].includes(cid) ? s[gid].filter((x) => x !== cid) : [...s[gid], cid]) : [cid] }));
  return (
    <SheetFrame title={item.name} onClose={onClose}
      footer={
        <div className="s-add">
          <div className="s-step big">
            <button aria-label="Minder" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty === 1}>−</button>
            <span className="num">{qty}</span>
            <button aria-label="Meer" onClick={() => setQty((q) => q + 1)}>+</button>
          </div>
          <button className="s-cta" disabled={missing.length > 0} onClick={() => onAdd(Object.values(sel).flat(), qty)}>
            {missing.length ? `Kies ${missing[0].name.toLowerCase()}` : `Toevoegen · ${eur((item.price_cents + extra) * qty)}`}
          </button>
        </div>
      }>
      {item.image_path && <img className="s-hero" src={storageUrl + item.image_path} alt="" />} {/* eslint-disable-line @next/next/no-img-element */}
      {item.description && <p className="muted" style={{ marginTop: 0 }}>{item.description}</p>}
      {item.option_groups.map((g) => (
        <fieldset className="s-group" key={g.id}>
          <legend><b>{g.name}</b><span className={`s-tag ${g.required && !sel[g.id]?.length ? "req" : ""}`}>{g.required ? (sel[g.id]?.length ? "✓" : "Verplicht") : g.multi ? "Optioneel · meerdere" : "Optioneel"}</span></legend>
          {g.option_choices.map((c) => {
            const on = sel[g.id]?.includes(c.id) ?? false;
            return (
              <label key={c.id} className={`s-choice ${on ? "on" : ""}`}>
                <input type={g.multi ? "checkbox" : "radio"} name={g.id} checked={on} onChange={() => toggle(g.id, c.id, g.multi)} />
                <span className={`s-mark ${g.multi ? "box" : ""}`} aria-hidden="true" />
                <span className="s-cn">{c.name}</span>
                {c.extra_cents > 0 && <span className="num s-ce">+{eur(c.extra_cents)}</span>}
              </label>
            );
          })}
        </fieldset>
      ))}
    </SheetFrame>
  );
}

function HoursTable({ hours, today }: { hours: HourRow[]; today: number }) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <table className="s-hours"><caption>Openingsuren</caption><tbody>{order.map((d) => {
      const rows = hours.filter((h) => h.weekday === d).sort((a, b) => a.opens.localeCompare(b.opens));
      return <tr key={d} className={d === today ? "today" : ""}><th>{DAYS[d]}</th><td>{rows.length ? rows.map((h) => `${h.opens.slice(0, 5)}–${h.closes.slice(0, 5)}`).join(", ") : "gesloten"}</td></tr>;
    })}</tbody></table>
  );
}
