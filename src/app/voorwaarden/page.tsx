import Link from "next/link";
import Legal, { legalSeller, who } from "@/components/Legal";

export const revalidate = 3600;
export const metadata = { title: "Algemene voorwaarden" };

export default async function Page() {
  const s = await legalSeller();
  const name = s?.name || "ITPRONET";
  return (
    <Legal title="Algemene voorwaarden">
      <h2>1. Partijen en toepassing</h2>
      <p>Deze voorwaarden gelden voor elke overeenkomst over BestelBon tussen {who(s)} (hierna “{name}”) en de onderneming die BestelBon gebruikt (hierna “de zaak”). Ze gaan voor op de voorwaarden van de zaak. Afwijkingen gelden alleen als ze schriftelijk zijn afgesproken, bijvoorbeeld in een offerte.</p>

      <h2>2. De dienst</h2>
      <p>BestelBon bestaat uit een online bestelpagina voor de zaak, het automatisch afdrukken van bestellingen op een bonprinter, een beheerpaneel (menu, bestellingen, verkoopcijfers, instellingen) en, in het Pro-pakket, eigen logo en kleuren. De inhoud van elk pakket staat op bestelbon.eu of in de offerte.</p>

      <h2>3. Totstandkoming</h2>
      <p>De overeenkomst start wanneer {name} een aanmelding of ondertekende offerte bevestigt. De zaak verklaart dat de opgegeven bedrijfsgegevens juist zijn en dat de persoon die zich aanmeldt de zaak mag vertegenwoordigen.</p>

      <h2>4. Printers en installatie</h2>
      <ul>
        <li>Printers worden verkocht. Ze blijven eigendom van {name} tot de factuur volledig betaald is.</li>
        <li>Op printers geldt de garantie van de fabrikant. Schade door vallen, vocht, vet, overspanning of verkeerd gebruik valt daar niet onder.</li>
        <li>Bij de installatie sluiten we de printer aan op het netwerk van de zaak en zetten we het menu klaar. De zaak zorgt voor stroom, een werkende internetverbinding en, voor de kabelversie, een vrije netwerkpoort.</li>
      </ul>

      <h2>5. Prijzen en betaling</h2>
      <ul>
        <li>Alle prijzen zijn exclusief btw. Het abonnement wordt maandelijks vooraf gefactureerd; printers en installatie eenmalig.</li>
        <li>Facturen zijn betaalbaar binnen 14 dagen, met de gestructureerde mededeling op de factuur. Facturen worden via Peppol of per e-mail verstuurd.</li>
        <li>Bij laattijdige betaling zijn van rechtswege en zonder ingebrekestelling de interest en de forfaitaire vergoeding van € 40 verschuldigd volgens de wet van 2 augustus 2002 betreffende de bestrijding van de betalingsachterstand bij handelstransacties.</li>
        <li>Blijft een factuur na een herinnering onbetaald, dan mag {name} de bestelpagina pauzeren tot de betaling binnen is.</li>
        <li>{name} mag de prijzen aanpassen met minstens 30 dagen voorafgaande melding. De zaak mag dan opzeggen tegen de datum van de nieuwe prijs.</li>
      </ul>

      <h2>6. Duur en opzegging</h2>
      <p>Het abonnement loopt voor onbepaalde duur en is maandelijks opzegbaar per e-mail naar info@bestelbon.eu, met een opzegtermijn van één maand, tenzij de offerte een minimale looptijd vermeldt. Betaalde maanden worden niet terugbetaald. Na het einde gaat de bestelpagina offline en worden de gegevens verwijderd zoals in de <Link href="/verwerkersovereenkomst">verwerkersovereenkomst</Link> staat.</p>

      <h2>7. Verantwoordelijkheid van de zaak</h2>
      <ul>
        <li>De zaak is verantwoordelijk voor haar menu, prijzen (inclusief btw voor consumenten), beschrijvingen en allergeneninformatie, en voor de bestellingen die ze aanneemt en uitvoert.</li>
        <li>De zaak is verkoper tegenover haar klanten. {name} is geen partij bij de verkoop van eten.</li>
        <li>De zaak houdt haar logingegevens geheim en meldt misbruik meteen.</li>
        <li>De zaak zorgt dat de printer aanstaat en papier heeft tijdens de openingsuren.</li>
      </ul>

      <h3>Geregistreerd kassasysteem (witte kassa)</h3>
      <ul>
        <li>BestelBon is een bestelplatform en geen geregistreerd kassasysteem (GKS) in de zin van het koninklijk besluit van 30 december 2009. Het levert geen btw-kasticket af.</li>
        <li>De zaak gaat zelf na of ze een GKS moet gebruiken, bijvoorbeeld omdat haar omzet uit restaurant- en cateringdiensten de wettelijke drempel overschrijdt, en blijft als enige verantwoordelijk voor haar fiscale verplichtingen, waaronder btw, kastickets en de GKS-verplichtingen.</li>
        <li>Is de zaak GKS-plichtig, dan registreert ze elke bestelling via BestelBon in haar GKS en levert ze het btw-kasticket af, zolang er geen gecertificeerde koppeling tussen BestelBon en haar kassasysteem is.</li>
        <li>De bestelgegevens blijven ter beschikking in het beheerpaneel en kunnen worden geëxporteerd, zodat de zaak ze kan voorleggen aan de btw-administratie. Persoonsgegevens van klanten worden na 30 dagen gewist; bestelde artikelen, bedragen en tijdstippen blijven bewaard.</li>
        <li>{name} is niet aansprakelijk voor boetes of naheffingen die de zaak oploopt omdat ze haar GKS-verplichtingen niet nakomt.</li>
      </ul>

      <h2>8. Beschikbaarheid en storingen</h2>
      <p>{name} doet wat redelijk mogelijk is om BestelBon ononderbroken te laten werken, maar garandeert dat niet. Valt de printer uit (bijvoorbeeld door een stroomonderbreking), dan pauzeert de bestelpagina automatisch en worden wachtende bonnen afgedrukt zodra de printer terug online is. Gepland onderhoud gebeurt zoveel mogelijk buiten de gebruikelijke openingsuren.</p>

      <h2>9. Aansprakelijkheid</h2>
      <p>De aansprakelijkheid van {name} is beperkt tot directe schade en tot het bedrag dat de zaak in de 12 maanden voor het schadegeval voor het abonnement betaalde. {name} is niet aansprakelijk voor indirecte schade zoals gederfde omzet, gemiste bestellingen of reputatieschade, en niet voor storingen bij de internetverbinding of het netwerk van de zaak. Deze beperkingen gelden niet bij opzet of zware fout.</p>

      <h2>10. Intellectuele eigendom</h2>
      <p>De software, het ontwerp en de merknaam BestelBon blijven eigendom van {name}. De zaak blijft eigenaar van haar menu, foto&apos;s en logo en geeft {name} het recht die te tonen op de bestelpagina zolang de overeenkomst loopt.</p>

      <h2>11. Persoonsgegevens</h2>
      <p>Voor de gegevens van de klanten van de zaak is de zaak verwerkingsverantwoordelijke en {name} verwerker. De <Link href="/verwerkersovereenkomst">verwerkersovereenkomst</Link> maakt deel uit van deze voorwaarden. Zie ook de <Link href="/privacy">privacyverklaring</Link>.</p>

      <h2>12. Overmacht</h2>
      <p>Bij overmacht, zoals grote storingen bij hosting- of netwerkproviders, cyberaanvallen, stakingen of natuurrampen, worden de verplichtingen van {name} opgeschort zolang de overmacht duurt.</p>

      <h2>13. Wijzigingen</h2>
      <p>{name} mag deze voorwaarden wijzigen en meldt dat minstens 30 dagen vooraf per e-mail. Gaat de zaak niet akkoord, dan mag ze opzeggen voor de wijziging ingaat.</p>

      <h2>14. Toepasselijk recht</h2>
      <p>Het Belgisch recht is van toepassing. Geschillen worden behandeld door de rechtbanken van Antwerpen, afdeling Antwerpen.</p>
    </Legal>
  );
}
