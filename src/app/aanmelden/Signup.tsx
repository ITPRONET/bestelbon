"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { packageOf, ROLES, type Conn, type Setup } from "@/lib/setup";
import { PicCable, PicOne, PicPowerline, PicSelf, PicTwo, PicUnknown, PicVisit } from "./Pics";

const eur = (c: number) => new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(c / 100);

function Choice({ on, pick, pic, title, text }: { on: boolean; pick: () => void; pic: ReactNode; title: string; text: string }) {
  return (
    <button type="button" className="choice" aria-pressed={on} onClick={pick}>
      <span className="choice-pic">{pic}</span>
      <b>{title}</b>
      <small>{text}</small>
    </button>
  );
}

const TYPES = ["Frituur", "Pizzeria", "Broodjeszaak", "Afhaalrestaurant", "Snackbar", "Pita & kebab"];
type P = { standaard: string; pro: string; installatie: string; jaarStandaard: string; jaarPro: string; admin: string; adminFree: string | null; c: { printer: number; powerline: number; installatie: number; admin: number } };

export default function Signup({ initialPlan, prices }: { initialPlan: "standaard" | "pro"; prices: P }) {
  const [t0] = useState(() => Date.now());
  const [plan, setPlan] = useState(initialPlan);
  const [billing, setBilling] = useState<"maand" | "jaar">("maand");
  const [state, setState] = useState<"form" | "busy" | "done">("form");
  const [err, setErr] = useState("");
  const [setup, setSetup] = useState<Setup>({ printers: 1, conns: ["kabel", "kabel"], install: "zelf" });
  const pk = packageOf(setup);
  const setConn = (i: number, c: Conn) => setSetup((x) => ({ ...x, conns: x.conns.map((v, j) => (j === i ? c : v)) }));
  const oneTime = pk.printers * prices.c.printer + pk.adapters * prices.c.powerline + (setup.install === "ter_plaatse" ? prices.c.installatie : 0) + (prices.adminFree ? 0 : prices.c.admin);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setState("busy");
    const body = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const res = await fetch("/api/aanmelden", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, plan, billing, setup, t: Date.now() - t0 }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error ?? "Aanmelden is niet gelukt. Probeer opnieuw of mail naar info@bestelbon.eu."); setState("form"); return; }
    setState("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (state === "done") return (
    <div className="panel" style={{ display: "grid", gap: 8 }}>
      <h2 className="h2">Bedankt, je aanmelding is binnen.</h2>
      <p style={{ margin: 0 }}>{setup.install === "ter_plaatse" ? "We bellen je binnen één werkdag om de installatie af te spreken." : "We bellen je binnen één werkdag om alles te overlopen. Daarna maken we je pakket klaar: de printer staat al in je panel en de adapters zijn al gekoppeld, je hoeft enkel de stekkers in te steken."}{pk.unknown ? " We bekijken dan ook samen hoe je printer het best aan internet raakt." : ""} Een kopie van je aanmelding staat in je mailbox.</p>
      <p className="muted small" style={{ margin: 0 }}>Vragen? Mail naar info@bestelbon.eu.</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="sgrid">
      <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
        <section className="panel" style={{ display: "grid", gap: 12 }}>
          <h2 className="h2">1. Pakket</h2>
          <div className="plans">
            {(["standaard", "pro"] as const).map((k) => (
              <button type="button" key={k} className="plan" aria-pressed={plan === k} onClick={() => setPlan(k)}>
                <b>{k === "pro" ? "Pro" : "Standaard"}</b>
                <span>{k === "pro" ? prices.pro : prices.standaard} <small>/ maand excl. btw</small></span>
                <small>{k === "pro" ? "Alles van Standaard, plus je eigen logo en kleuren, tot 3 eigen foto's bovenaan, 3 menuweergaven (lijst, fotoraster, menukaart), een klantenkaart met stempels en je eigen domeinnaam (bv. bestellen.jouwzaak.be)." : "Bestelpagina, automatische keukenbonnen, beheerpaneel en verkoopcijfers."}</small>
              </button>
            ))}
          </div>
          <div className="plans">
            <button type="button" className="plan" aria-pressed={billing === "maand"} onClick={() => setBilling("maand")}>
              <b>Maandelijks</b><small>Per maand via domiciliëring</small>
            </button>
            <button type="button" className="plan" aria-pressed={billing === "jaar"} onClick={() => setBilling("jaar")}>
              <b>Jaarlijks vooraf <span className="pill ok">−10%</span></b>
              <small>{plan === "pro" ? prices.jaarPro : prices.jaarStandaard} per jaar excl. btw</small>
            </button>
          </div>
        </section>
        <section className="panel" style={{ display: "grid", gap: 14 }}>
          <h2 className="h2">2. Je printers</h2>
          <p className="muted small" style={{ margin: 0 }}>Je krijgt een pakket waarin alles al klaarstaat: de printer is gekoppeld aan je BestelBon-panel en beplakt, eventuele adapters zijn al aan elkaar gekoppeld.</p>
          <fieldset className="q">
            <legend>Hoeveel printers wil je?</legend>
            <div className="choices">
              <Choice on={setup.printers === 1} pick={() => setSetup((x) => ({ ...x, printers: 1 }))} pic={<PicOne />} title="1 printer" text="In de keuken. Bij levering komt de bezorgbon er meteen na de keukenbon uit." />
              <Choice on={setup.printers === 2} pick={() => setSetup((x) => ({ ...x, printers: 2 }))} pic={<PicTwo />} title="2 printers" text="Eén in de keuken, één aan de toog voor de bezorg- of afhaalbon." />
            </div>
          </fieldset>
          {Array.from({ length: setup.printers }, (_, i) => (
            <fieldset className="q" key={i}>
              <legend>{setup.printers === 1 ? "Hoe raakt de printer aan internet?" : `Printer ${i + 1} (${ROLES[i].toLowerCase()}): hoe raakt die aan internet?`}</legend>
              <div className="choices three">
                <Choice on={setup.conns[i] === "kabel"} pick={() => setConn(i, "kabel")} pic={<PicCable />} title="Met een kabel" text="Je router of modem staat op max. 2 m van de plek van de printer en heeft een vrije netwerkpoort." />
                <Choice on={setup.conns[i] === "powerline"} pick={() => setConn(i, "powerline")} pic={<PicPowerline />} title="Via het stopcontact" text="De router staat verder weg. Er is een vrij stopcontact in de muur bij de printer (geen stekkerdoos)." />
                <Choice on={setup.conns[i] === "onbekend"} pick={() => setConn(i, "onbekend")} pic={<PicUnknown />} title="Weet ik niet" text="Geen probleem: we bellen je en bekijken het samen." />
              </div>
            </fieldset>
          ))}
          <fieldset className="q">
            <legend>Installeren</legend>
            <div className="choices">
              <Choice on={setup.install === "zelf"} pick={() => setSetup((x) => ({ ...x, install: "zelf" }))} pic={<PicSelf />} title="Zelf, met ons pakket" text="Alles is vooraf ingesteld: stekkers erin en klaar. Je menu zet je zelf in het panel." />
              <Choice on={setup.install === "ter_plaatse"} pick={() => setSetup((x) => ({ ...x, install: "ter_plaatse" }))} pic={<PicVisit />} title={`Wij komen langs (${prices.installatie})`} text="We installeren alles ter plaatse, testen het netwerk en zetten je menu klaar." />
            </div>
          </fieldset>
          {pk.adapters > 0 && <p className="small" style={{ margin: 0 }}>Via het stopcontact gebruiken we powerline-adapters: één bij je router en één bij {pk.powerline > 1 ? "elke printer" : "de printer"}. Je hebt dus ook een vrij stopcontact bij je router nodig en een vrije netwerkpoort op de router. De adapters hebben een stopcontact aan de voorkant, dus je verliest geen stopcontact.</p>}
        </section>
        <section className="panel" style={{ display: "grid", gap: 12 }}>
          <h2 className="h2">3. Je zaak</h2>
          <div className="fgrid">
            <label className="field" style={{ gridColumn: "1/-1" }}>Naam van de zaak<input name="restaurant_name" required maxLength={60} /></label>
            <label className="field">Soort<select name="restaurant_type">{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="field">Gewenste startdatum<input name="wanted_start" type="date" /></label>
            <label className="field" style={{ gridColumn: "1/-1" }}>Heeft je zaak een geregistreerd kassasysteem (witte kassa)?
              <select name="gks" defaultValue="nee"><option value="nee">Nee</option><option value="ja">Ja</option><option value="weet_niet">Weet ik niet</option></select>
            </label>
            <label className="field" style={{ gridColumn: "1/-1" }}>Opmerking<textarea name="message" rows={3} maxLength={1000} placeholder="Bv. we hebben al een menu op papier, of we leveren in Ekeren en Brasschaat." /></label>
          </div>
        </section>
      </div>
      <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
      <section className="panel pkg" style={{ display: "grid", gap: 8, alignContent: "start" }}>
        <h2 className="h2">Je pakket</h2>
        <ul className="pkg-list">
          <li><span>{pk.printers}× bonprinter, gekoppeld aan je panel</span><span className="num">{eur(pk.printers * prices.c.printer)}</span></li>
          {pk.adapters > 0 && <li><span>{pk.adapters}× powerline-adapter, vooraf gekoppeld</span><span className="num">{eur(pk.adapters * prices.c.powerline)}</span></li>}
          <li><span>Netwerkkabels</span><span className="num">inbegrepen</span></li>
          {setup.install === "ter_plaatse" && <li><span>Installatie ter plaatse</span><span className="num">{eur(prices.c.installatie)}</span></li>}
          <li><span>Administratieve kosten</span><span className="num">{prices.adminFree ? <><s>{prices.admin}</s> gratis</> : prices.admin}</span></li>
          <li className="pkg-total"><span>Eenmalig</span><span className="num">{eur(oneTime)}</span></li>
          <li><span>Abonnement {plan === "pro" ? "Pro" : "Standaard"}</span><span className="num">{billing === "jaar" ? `${plan === "pro" ? prices.jaarPro : prices.jaarStandaard} / jaar` : `${plan === "pro" ? prices.pro : prices.standaard} / maand`}</span></li>
        </ul>
        <p className="muted small" style={{ margin: 0 }}>Bedragen excl. btw.{prices.adminFree ? ` Administratieve kosten gratis bij aanmelding tot ${prices.adminFree}.` : ""}{pk.unknown ? " De adapters bij “weet ik niet” zijn een schatting; we bevestigen na ons telefoontje." : ""}</p>
      </section>
      <section className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <h2 className="h2">4. Bedrijfsgegevens</h2>
        <div className="fgrid">
          <label className="field" style={{ gridColumn: "1/-1" }}>Bedrijfsnaam<input name="legal_name" required maxLength={100} placeholder="bv. Frituur Het Pleintje BV" /></label>
          <label className="field">Btw-nummer<input name="vat_number" required placeholder="BE 0123.456.789" /></label>
          <label className="field">Contactpersoon<input name="contact_name" required maxLength={80} autoComplete="name" /></label>
          <label className="field" style={{ gridColumn: "1/-1" }}>Straat en nummer<input name="street" required maxLength={100} autoComplete="street-address" /></label>
          <label className="field">Postcode<input name="postcode" required maxLength={10} inputMode="numeric" autoComplete="postal-code" /></label>
          <label className="field">Gemeente<input name="city" required maxLength={60} autoComplete="address-level2" /></label>
          <label className="field">E-mail<input name="email" type="email" required maxLength={120} autoComplete="email" /></label>
          <label className="field">Telefoon<input name="phone" type="tel" required maxLength={30} autoComplete="tel" /></label>
        </div>
        <label className="hp" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <label className="check" style={{ alignItems: "flex-start", fontWeight: 400 }}>
          <input type="checkbox" name="terms" required style={{ marginTop: 4 }} />
          <span>Ik ga akkoord met de <Link href="/voorwaarden" target="_blank">algemene voorwaarden</Link> en de <Link href="/verwerkersovereenkomst" target="_blank">verwerkersovereenkomst</Link>, en heb de <Link href="/privacy" target="_blank">privacyverklaring</Link> gelezen.</span>
        </label>
        {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
        <button className="btn btn-primary" disabled={state === "busy"}>{state === "busy" ? "Bezig…" : "Aanmelding versturen"}</button>
        <p className="muted small" style={{ margin: 0 }}>Je betaalt nog niets. De eerste factuur volgt wanneer je pakket klaarstaat.</p>
      </section>
      </div>
    </form>
  );
}
