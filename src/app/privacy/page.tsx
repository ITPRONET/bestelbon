import Legal, { legalSeller, who, SUBPROCESSORS } from "@/components/Legal";

export const revalidate = 3600;
export const metadata = { title: "Privacyverklaring" };

export default async function Page() {
  const s = await legalSeller();
  return (
    <Legal title="Privacyverklaring">
      <p>BestelBon is een bestelplatform voor frituren, pizzeria&apos;s, broodjeszaken en afhaalrestaurants. Hier lees je welke persoonsgegevens we verwerken, waarom, hoe lang en welke rechten je hebt.</p>

      <h2>1. Wie zijn wij?</h2>
      <p>BestelBon is een dienst van {who(s)}. Vragen over privacy stuur je naar <a href="mailto:info@bestelbon.eu">info@bestelbon.eu</a>.</p>

      <h2>2. Twee rollen</h2>
      <ul>
        <li><b>Bestel je eten bij een zaak?</b> Dan is die zaak verantwoordelijk voor je gegevens. BestelBon verwerkt ze alleen in opdracht van de zaak, als verwerker. Je kunt met vragen bij de zaak terecht of bij ons; wij helpen de zaak om je vraag te beantwoorden.</li>
        <li><b>Ben je een zaak die BestelBon gebruikt?</b> Dan zijn wij verantwoordelijk voor de gegevens van je bedrijf, je contactpersonen en je logins.</li>
      </ul>

      <h2>3. Welke gegevens?</h2>
      <h3>Als je bestelt</h3>
      <ul>
        <li>naam, telefoonnummer en e-mailadres;</li>
        <li>bij levering: adres, postcode en gemeente;</li>
        <li>je bestelling, opmerking, gekozen tijdstip en betaalwijze;</li>
        <li>technische gegevens zoals je IP-adres in de serverlogs.</li>
      </ul>
      <h3>Als zaak</h3>
      <ul>
        <li>bedrijfsnaam, btw-nummer, adres, contactpersoon, e-mail en telefoon;</li>
        <li>e-mailadres en wachtwoord van de logins (het wachtwoord bewaren we niet leesbaar);</li>
        <li>facturen, betaalstatus en installatiegegevens;</li>
        <li>menu, logo en instellingen van je bestelpagina.</li>
      </ul>

      <h2>4. Waarvoor gebruiken we ze?</h2>
      <ul>
        <li><b>Je bestelling uitvoeren:</b> doorsturen naar de zaak en afdrukken op de bonprinter in de keuken, met je adres op de bezorgbon. Rechtsgrond: de overeenkomst met de zaak (art. 6.1.b AVG).</li>
        <li><b>De dienst aan zaken leveren en factureren.</b> Rechtsgrond: de overeenkomst (art. 6.1.b) en de boekhoudwetgeving (art. 6.1.c).</li>
        <li><b>Beveiliging en misbruik voorkomen</b>, zoals valse bestellingen of aanmeldingen. Rechtsgrond: ons gerechtvaardigd belang (art. 6.1.f).</li>
      </ul>
      <p>We verkopen geen gegevens, sturen bestellers geen reclame en gebruiken geen tracking- of advertentiecookies.</p>

      <h2>5. Hoe lang bewaren we ze?</h2>
      <ul>
        <li><b>Gegevens van bestellers:</b> automatisch gewist 30 dagen na de bestelling. Wat besteld werd en de bedragen blijven anoniem bewaard voor de verkoopcijfers van de zaak.</li>
        <li><b>Facturen:</b> 10 jaar, zoals de Belgische boekhoudwetgeving vraagt.</li>
        <li><b>Gegevens van zaken en logins:</b> zolang het abonnement loopt en daarna maximaal 1 jaar.</li>
        <li><b>Aanmeldingen die geen klant worden:</b> maximaal 12 maanden.</li>
      </ul>

      <h2>6. Wie krijgt je gegevens?</h2>
      <p>De zaak waar je bestelt, en de dienstverleners die we nodig hebben om BestelBon te laten werken:</p>
      <table className="tbl"><thead><tr><th>Partij</th><th>Waarvoor</th><th>Waar</th></tr></thead>
        <tbody>{SUBPROCESSORS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody></table>
      <p>Zodra online betalen beschikbaar is, verwerkt de betaaldienst je betaling. Dat staat dan in deze lijst.</p>

      <h2>7. Cookies</h2>
      <p>De bestelpagina en de BestelBon-gids zetten geen cookies om je te volgen. De postcode die je in de gids zoekt, gebruiken we alleen om de lijst met zaken te tonen; we koppelen ze niet aan jou. Je laatste postcode en je bestelgegevens worden in je eigen browser onthouden, zodat je ze niet opnieuw hoeft in te vullen. In het beheerpaneel voor zaken gebruiken we alleen een noodzakelijke cookie om je ingelogd te houden.</p>

      <h2>8. Beveiliging</h2>
      <p>Alle verbindingen zijn versleuteld (HTTPS). Elke zaak ziet alleen haar eigen bestellingen. Wachtwoorden en printersleutels worden niet leesbaar opgeslagen.</p>

      <h2>9. Je rechten</h2>
      <p>Je hebt recht op inzage, verbetering, wissing, beperking, overdraagbaarheid en bezwaar. Mail naar <a href="mailto:info@bestelbon.eu">info@bestelbon.eu</a>; we antwoorden binnen een maand. Ben je niet tevreden, dan kun je klacht indienen bij de Gegevensbeschermingsautoriteit, Drukpersstraat 35, 1000 Brussel, <a href="https://www.gegevensbeschermingsautoriteit.be" rel="noopener">gegevensbeschermingsautoriteit.be</a>.</p>

      <h2>10. Wijzigingen</h2>
      <p>Als we deze verklaring aanpassen, staat de nieuwe versie op deze pagina. Belangrijke wijzigingen melden we aan de zaken per e-mail.</p>
    </Legal>
  );
}
