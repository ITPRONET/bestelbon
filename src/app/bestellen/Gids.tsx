import Link from "next/link";
import type { CSSProperties } from "react";
import { eur } from "@/lib/money";
import type { GidsZaak } from "@/lib/gids";
import PostcodeForm from "./PostcodeForm";
import GidsFx from "./GidsFx";

/** Decorative 3D scene: a kitchen ticket floating above a perspective grid, with glossy orbs and glass chips. */
function Scene({ compact }: { compact?: boolean }) {
  return (
    <div className={`g-scene${compact ? " compact" : ""}`} aria-hidden="true">
      <div className="g-floor" />
      <span className="g-orb o1" /><span className="g-orb o2" /><span className="g-orb o3" />
      {!compact && (
        <div className="g-ticket-wrap">
          <div className="g-ticket">
            <div className="g-tk-bar">KEUKEN</div>
            <div className="g-tk-no">#42</div>
            <div className="g-tk-mode">LEVERING · 18:30</div>
            <div className="g-tk-rule" />
            <div className="g-tk-line"><b>2 x Grote friet</b></div>
            <div className="g-tk-opt">&gt; stoofvleessaus</div>
            <div className="g-tk-line"><b>1 x Bicky burger</b></div>
            <div className="g-tk-opt">&gt; zonder ui</div>
            <div className="g-tk-line"><b>2 x Frikandel</b></div>
            <div className="g-tk-rule" />
            <div className="g-tk-bar">BETAALD ONLINE</div>
          </div>
          <div className="g-ticket-shadow" />
        </div>
      )}
      {!compact && <span className="g-chip c1"><i className="g-dot" />Open tot 22:00</span>}
      {!compact && <span className="g-chip c2">± 30 min</span>}
    </div>
  );
}

export function GidsHead({ pc, place }: { pc?: string; place?: string }) {
  const compact = !!pc;
  return (
    <header className={`g-head${compact ? " compact" : ""}`}>
      <GidsFx />
      <span className="g-blob b1" aria-hidden="true" /><span className="g-blob b2" aria-hidden="true" /><span className="g-blob b3" aria-hidden="true" />
      <div className="wrap g-head-in">
        <div className="g-copy">
          <Link href="/" className="g-logo"><span className="g-logo-mark" aria-hidden="true" /><span>Bestel<b>Bon</b></span></Link>
          {!compact && <span className="g-kicker">Lokaal · rechtstreeks · zonder tussenpersoon</span>}
          <h1>{place ? <>Eten bestellen in <span className="g-grad">{place}</span></> : <>Lekker eten,<br /><span className="g-grad">rechtstreeks</span> bij de zaak</>}</h1>
          <p>Frituren, pizzeria&apos;s en afhaalzaken bij jou in de buurt. Je bestelt rechtstreeks, zonder tussenpersoon.</p>
          <PostcodeForm initial={pc} />
        </div>
        <Scene compact={compact} />
      </div>
    </header>
  );
}

const ICONS = {
  direct: <path d="M4 12h12M12 6l6 6-6 6" />,
  fair: <><circle cx="12" cy="12" r="8" /><path d="M9 12.5l2 2 4-4.5" /></>,
  print: <><path d="M7 3h10v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z" /><path d="M10 8h4M10 12h4" /></>,
};

export function GidsWhy() {
  const items: [keyof typeof ICONS, string, string][] = [
    ["direct", "Rechtstreeks", "Je bestelling gaat meteen naar de zaak zelf, niet naar een tussenpersoon."],
    ["fair", "Eerlijke prijzen", "Geen servicekosten bovenop je bestelling. Je betaalt wat de zaak vraagt."],
    ["print", "Meteen in de keuken", "Je bon rolt binnen enkele seconden uit de printer in de keuken."],
  ];
  return (
    <section className="wrap g-why">
      {items.map(([k, t, d], i) => (
        <div key={k} className="g-why-card" style={{ "--i": i } as CSSProperties}>
          <span className={`g-ico ${k}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[k]}</svg></span>
          <b>{t}</b><span>{d}</span>
        </div>
      ))}
    </section>
  );
}

function Card({ z, storage, mode, i }: { z: GidsZaak; storage: string; mode: "levering" | "afhalen"; i: number }) {
  return (
    <Link href={`/${z.slug}${mode === "afhalen" ? "?modus=afhalen" : ""}`} className={`g-card ${z.state}`} style={{ "--i": i, "--c": z.accent } as CSSProperties}>
      <span className="g-shine" aria-hidden="true" />
      {z.logo
        ? <img src={storage + z.logo} alt="" className="g-logo-img" /> /* eslint-disable-line @next/next/no-img-element */
        : <span className="g-mono">{z.name[0]}</span>}
      <span className="g-t">
        <b>{z.name}</b>
        <small>{z.type}{z.city ? ` · ${z.city}` : ""}{z.km !== null ? ` · ${String(z.km).replace(".", ",")} km` : ""}</small>
        <span className={`g-state ${z.state}`}>{z.state === "open" && <i className="g-dot" />}{z.label}</span>
        <small className="g-meta">{mode === "levering" ? `± ${z.eta} min · min. ${eur(z.min)} · ${z.fee ? `levering ${eur(z.fee)}` : "gratis levering"}` : `afhalen · klaar in ± ${z.eta} min`}</small>
      </span>
      <span className="g-go" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></span>
    </Link>
  );
}

export function GidsList({ title, items, storage, mode, empty }: { title: string; items: GidsZaak[]; storage: string; mode: "levering" | "afhalen"; empty: string }) {
  return (
    <section className="g-sec">
      <h2>{title} <span>{items.length}</span></h2>
      {items.length ? <div className="g-list">{items.map((z, i) => <Card key={z.slug + mode} z={z} storage={storage} mode={mode} i={i} />)}</div> : <p className="g-empty">{empty}</p>}
    </section>
  );
}

export function GidsFoot() {
  return (
    <footer className="wrap g-foot">
      <p>Volgorde: eerst zaken die nu open zijn, daarna op afstand. Zaken betalen niet voor een hogere plaats. Elke zaak verkoopt zelf; haar bedrijfsgegevens staan onder “i” op haar bestelpagina.</p>
      <p><Link href="/privacy">Privacy</Link> · <Link href="/voorwaarden">Voorwaarden</Link> · <a href={process.env.NEXT_PUBLIC_MARKETING_URL || "https://bestelbon.eu"}>Heb je een zaak? Over BestelBon</a></p>
    </footer>
  );
}
