import Link from "next/link";
import { eur } from "@/lib/money";
import type { GidsZaak } from "@/lib/gids";
import PostcodeForm from "./PostcodeForm";

export function GidsHead({ pc, place }: { pc?: string; place?: string }) {
  return (
    <header className="g-head">
      <div className="wrap g-head-in">
        <Link href="/" className="g-logo">Bestel<b>Bon</b></Link>
        <h1>{place ? <>Eten bestellen in <span>{place}</span></> : <>Lekker eten,<br />rechtstreeks bij de zaak</>}</h1>
        <p>Frituren, pizzeria&apos;s en afhaalzaken bij jou in de buurt. Je bestelt rechtstreeks, zonder tussenpersoon.</p>
        <PostcodeForm initial={pc} />
      </div>
    </header>
  );
}

function Card({ z, storage, mode }: { z: GidsZaak; storage: string; mode: "levering" | "afhalen" }) {
  return (
    <Link href={`/${z.slug}${mode === "afhalen" ? "?modus=afhalen" : ""}`} className={`g-card ${z.state}`}>
      {z.logo ? <img src={storage + z.logo} alt="" className="g-logo-img" /> /* eslint-disable-line @next/next/no-img-element */ : <span className="g-mono" style={{ background: z.accent }}>{z.name[0]}</span>}
      <span className="g-t">
        <b>{z.name}</b>
        <small>{z.type}{z.city ? ` · ${z.city}` : ""}{z.km !== null ? ` · ${String(z.km).replace(".", ",")} km` : ""}</small>
        <span className={`g-state ${z.state}`}>{z.label}</span>
        <small className="g-meta">{mode === "levering" ? `± ${z.eta} min · min. ${eur(z.min)} · ${z.fee ? `levering ${eur(z.fee)}` : "gratis levering"}` : `afhalen · klaar in ± ${z.eta} min`}</small>
      </span>
      <span className="g-go" aria-hidden="true">›</span>
    </Link>
  );
}

export function GidsList({ title, items, storage, mode, empty }: { title: string; items: GidsZaak[]; storage: string; mode: "levering" | "afhalen"; empty: string }) {
  return (
    <section className="g-sec">
      <h2>{title} <span>{items.length}</span></h2>
      {items.length ? <div className="g-list">{items.map((z) => <Card key={z.slug + mode} z={z} storage={storage} mode={mode} />)}</div> : <p className="muted">{empty}</p>}
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
