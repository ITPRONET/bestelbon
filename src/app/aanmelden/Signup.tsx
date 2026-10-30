"use client";
import Link from "next/link";
import { useState } from "react";

const TYPES = ["Frituur", "Pizzeria", "Broodjeszaak", "Afhaalrestaurant", "Snackbar", "Pita & kebab"];
type P = { standaard: string; pro: string; kabel: string; wifi: string; installatie: string; jaarStandaard: string; jaarPro: string; admin: string; adminFree: string | null };

export default function Signup({ initialPlan, prices }: { initialPlan: "standaard" | "pro"; prices: P }) {
  const [t0] = useState(() => Date.now());
  const [plan, setPlan] = useState(initialPlan);
  const [billing, setBilling] = useState<"maand" | "jaar">("maand");
  const [state, setState] = useState<"form" | "busy" | "done">("form");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setState("busy");
    const body = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const res = await fetch("/api/aanmelden", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, plan, billing, t: Date.now() - t0 }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error ?? "Aanmelden is niet gelukt. Probeer opnieuw of mail naar info@bestelbon.eu."); setState("form"); return; }
    setState("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (state === "done") return (
    <div className="panel" style={{ display: "grid", gap: 8 }}>
      <h2 className="h2">Bedankt, je aanmelding is binnen.</h2>
      <p style={{ margin: 0 }}>We bellen je binnen één werkdag om de installatie af te spreken. Een kopie van je aanmelding staat in je mailbox.</p>
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
                <small>{k === "pro" ? "Alles van Standaard, plus je eigen logo, kleuren en domeinnaam (bv. bestellen.jouwzaak.be)." : "Bestelpagina, automatische keukenbonnen, beheerpaneel en verkoopcijfers."}</small>
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
          <div className="fgrid">
            <label className="field">Printers met kabel ({prices.kabel})<input name="printers_cable" type="number" min={0} max={5} defaultValue={1} /></label>
            <label className="field">Printers met wifi ({prices.wifi})<input name="printers_wifi" type="number" min={0} max={5} defaultValue={0} /></label>
          </div>
          <p className="muted small" style={{ margin: 0 }}>Installatie, netwerk en invoer van je menu: {prices.installatie} eenmalig. Administratieve kosten: {prices.adminFree ? <><s>{prices.admin}</s> <b>gratis bij aanmelding tot {prices.adminFree}</b></> : prices.admin}. Een tweede printer is handig als je een aparte bezorgbon wil.</p>
        </section>
        <section className="panel" style={{ display: "grid", gap: 12 }}>
          <h2 className="h2">2. Je zaak</h2>
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
      <section className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <h2 className="h2">3. Bedrijfsgegevens</h2>
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
        <p className="muted small" style={{ margin: 0 }}>Je betaalt nog niets. De eerste factuur volgt na de installatie.</p>
      </section>
    </form>
  );
}
