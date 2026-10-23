import Link from "next/link";
import Legal, { legalSeller, who, SUBPROCESSORS } from "@/components/Legal";

export const revalidate = 3600;
export const metadata = { title: "Verwerkersovereenkomst" };

export default async function Page() {
  const s = await legalSeller();
  return (
    <Legal title="Verwerkersovereenkomst">
      <p>Deze overeenkomst volgt artikel 28 van de Algemene Verordening Gegevensbescherming (AVG) en maakt deel uit van de <Link href="/voorwaarden">algemene voorwaarden</Link>. Ze geldt tussen de zaak die BestelBon gebruikt (de <b>verwerkingsverantwoordelijke</b>) en {who(s)} (de <b>verwerker</b>). De zaak aanvaardt ze bij de aanmelding.</p>

      <h2>1. Onderwerp</h2>
      <table className="tbl"><tbody>
        <tr><th>Doel</th><td>Online bestellingen ontvangen, afdrukken op de bonprinters van de zaak, tonen in het beheerpaneel en verkoopcijfers maken.</td></tr>
        <tr><th>Betrokkenen</th><td>Klanten die bij de zaak bestellen; medewerkers van de zaak met een login.</td></tr>
        <tr><th>Gegevens</th><td>Naam, telefoon, e-mail, leveradres, bestelling, opmerking, tijdstip, betaalwijze; e-mailadres van logins.</td></tr>
        <tr><th>Bewaring</th><td>Persoonsgegevens van bestellers worden 30 dagen na de bestelling automatisch gewist; bestelde artikelen en bedragen blijven anoniem bewaard.</td></tr>
        <tr><th>Duur</th><td>Zolang de overeenkomst over BestelBon loopt.</td></tr>
      </tbody></table>

      <h2>2. Instructies</h2>
      <p>De verwerker verwerkt de gegevens alleen voor het doel hierboven en volgens de schriftelijke instructies van de zaak, tenzij een wettelijke verplichting anders vraagt. Vindt de verwerker een instructie in strijd met de AVG, dan meldt hij dat meteen.</p>

      <h2>3. Vertrouwelijkheid</h2>
      <p>Alleen personen die de gegevens nodig hebben voor de dienst krijgen toegang, en zij zijn tot geheimhouding verplicht.</p>

      <h2>4. Beveiliging</h2>
      <ul>
        <li>Versleutelde verbindingen (HTTPS) voor de bestelpagina, het beheerpaneel en de printers.</li>
        <li>Toegangsregels in de database: elke zaak ziet alleen haar eigen gegevens.</li>
        <li>Wachtwoorden en printersleutels worden niet leesbaar opgeslagen.</li>
        <li>Database en hosting in de Europese Unie, met back-ups bij de hostingpartner.</li>
        <li>Automatisch wissen van klantgegevens na 30 dagen.</li>
      </ul>

      <h2>5. Subverwerkers</h2>
      <p>De zaak geeft algemene toestemming voor deze subverwerkers:</p>
      <table className="tbl"><thead><tr><th>Partij</th><th>Taak</th><th>Locatie</th></tr></thead>
        <tbody>{SUBPROCESSORS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody></table>
      <p>Een nieuwe subverwerker meldt de verwerker minstens 30 dagen vooraf per e-mail. De zaak kan binnen die termijn gemotiveerd bezwaar maken en, als er geen oplossing is, de overeenkomst opzeggen. De verwerker legt subverwerkers dezelfde verplichtingen op als in deze overeenkomst.</p>

      <h2>6. Doorgifte buiten de EER</h2>
      <p>Gegevens worden alleen buiten de Europese Economische Ruimte verwerkt met passende waarborgen, zoals een adequaatheidsbesluit (EU-VS Data Privacy Framework) of standaardcontractbepalingen van de Europese Commissie.</p>

      <h2>7. Rechten van betrokkenen</h2>
      <p>Krijgt de verwerker een verzoek van een betrokkene, dan stuurt hij het door naar de zaak. De verwerker helpt de zaak, voor zover redelijk, om binnen de wettelijke termijn te antwoorden.</p>

      <h2>8. Datalekken</h2>
      <p>De verwerker meldt een inbreuk op persoonsgegevens zonder onredelijke vertraging en uiterlijk binnen 48 uur na ontdekking aan de zaak, met de informatie die de zaak nodig heeft om de inbreuk binnen 72 uur bij de Gegevensbeschermingsautoriteit te melden.</p>

      <h2>9. Bijstand en controle</h2>
      <p>De verwerker helpt de zaak bij een gegevensbeschermingseffectbeoordeling als die nodig is, en geeft alle informatie die nodig is om aan te tonen dat deze overeenkomst wordt nageleefd. De zaak mag maximaal één keer per jaar, na 30 dagen voorafgaande melding en op eigen kosten, een audit laten uitvoeren.</p>

      <h2>10. Einde</h2>
      <p>Na het einde van de overeenkomst kan de zaak binnen 30 dagen een export van haar gegevens vragen. Daarna verwijdert de verwerker de persoonsgegevens, behalve wat hij wettelijk moet bewaren, zoals facturen.</p>

      <h2>11. Aansprakelijkheid</h2>
      <p>Voor de aansprakelijkheid gelden de bepalingen van de <Link href="/voorwaarden">algemene voorwaarden</Link>, onverminderd artikel 82 AVG.</p>
    </Legal>
  );
}
