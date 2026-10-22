import Link from "next/link";
import { seller, type Seller } from "@/lib/invoice";
import { TERMS_DATE } from "@/lib/legal";

export async function legalSeller() {
  try { return await seller(); } catch { return null; }
}

export function who(s: Seller | null) {
  if (!s) return "ITPRONET, Ekeren (België), info@bestelbon.eu";
  return [s.name, [s.street, `${s.postcode} ${s.city}`.trim()].filter(Boolean).join(", "), s.vat && `btw ${s.vat}`, s.email].filter(Boolean).join(" · ");
}

export default function Legal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <header className="top"><div className="wrap"><Link className="logo" href="/">Bestel<b>Bon</b></Link></div></header>
      <main className="wrap legal">
        <nav className="legal-nav small"><Link href="/privacy">Privacy</Link><Link href="/voorwaarden">Algemene voorwaarden</Link><Link href="/verwerkersovereenkomst">Verwerkersovereenkomst</Link></nav>
        <h1>{title}</h1>
        <p className="muted small">Versie van {TERMS_DATE}</p>
        {children}
      </main>
    </>
  );
}

export const SUBPROCESSORS: [string, string, string][] = [
  ["Supabase Inc.", "Database, inloggen en opslag van logo's", "Servers in Frankfurt (Duitsland)"],
  ["Vercel Inc.", "Hosting van de webapplicatie", "Verwerking in Frankfurt (Duitsland); Amerikaans bedrijf, doorgifte op basis van het EU-VS Data Privacy Framework en standaardcontractbepalingen"],
  ["E-mailhostingprovider van bestelbon.eu", "Versturen van e-mails (inloggen, facturen, meldingen)", "Europese Unie"],
];
