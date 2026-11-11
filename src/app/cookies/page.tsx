import Link from "next/link";
import Legal from "@/components/Legal";

export const revalidate = 3600;
export const metadata = { title: "Cookiebeleid" };

const COOKIES: [string, string, string, string][] = [
  ["sb-…-auth-token", "Cookie", "Houdt een zaak ingelogd in het beheerpaneel.", "Tot je uitlogt"],
  ["bb_act", "Cookie", "Logt het beheerpaneel uit na een tijd zonder activiteit.", "24 uur"],
  ["bb_mollie_state", "Cookie", "Beveiligt het koppelen van een Mollie-account aan een zaak.", "15 minuten"],
  ["bb_cookie_ok", "Lokale opslag", "Onthoudt dat je deze cookiemelding gesloten hebt.", "Tot je ze wist"],
  ["bb_cart_…", "Sessie-opslag", "Bewaart je winkelmandje terwijl je online betaalt.", "Tot je het tabblad sluit"],
  ["bb_pc", "Lokale opslag", "Onthoudt de laatste postcode die je in de gids zocht.", "Tot je ze wist"],
  ["bb_kaart", "Lokale opslag", "Onthoudt of je stempels wil sparen op de klantenkaart.", "Tot je ze wist"],
  ["bb_klant", "Lokale opslag", "Alleen als je \"Onthoud mijn gegevens\" aanvinkt: je naam, telefoon, e-mail en adres voor een volgende bestelling.", "Tot je het vinkje uitzet of ze wist"],
];

export default function Page() {
  return (
    <Legal title="Cookiebeleid">
      <p>BestelBon gebruikt geen cookies om je te volgen en geen advertentiecookies. We gebruiken alleen cookies en opslag in je browser die nodig zijn om de site te laten werken, of die je zelf aanzet.</p>

      <h2>1. Welke cookies en opslag?</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="legal-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: ".92rem" }}>
          <thead><tr>{["Naam", "Soort", "Waarvoor", "Hoe lang"].map((h) => <th key={h} style={{ textAlign: "left", padding: "8px 6px", borderBottom: "2px solid #e6e8f3" }}>{h}</th>)}</tr></thead>
          <tbody>
            {COOKIES.map(([n, k, w, d]) => (
              <tr key={n}>{[n, k, w, d].map((c, i) => <td key={i} style={{ padding: "8px 6px", borderBottom: "1px solid #eef0f6", verticalAlign: "top", fontFamily: i === 0 ? "ui-monospace,monospace" : undefined }}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>2. Toestemming</h2>
      <p>Voor cookies die strikt nodig zijn om de dienst te leveren, is geen toestemming nodig. Je gegevens onthouden voor een volgende bestelling doen we alleen als je dat zelf aanvinkt bij het bestellen. Zet je het vinkje uit, dan wissen we ze meteen uit je browser.</p>

      <h2>3. Online betalen</h2>
      <p>Betaal je online, dan ga je naar de betaalpagina van Mollie. Mollie gebruikt daar eigen cookies om de betaling veilig te verwerken. Meer daarover lees je in het privacybeleid op mollie.com.</p>

      <h2>4. Website bestelbon.eu</h2>
      <p>Onze website zet voor bezoekers geen cookies om je te volgen. Lettertypes en afbeeldingen komen van onze eigen server, niet van Google of andere diensten.</p>

      <h2>5. Cookies wissen</h2>
      <p>Je kan cookies en opgeslagen gegevens altijd wissen in de instellingen van je browser. Vragen? Mail naar <a href="mailto:info@bestelbon.eu">info@bestelbon.eu</a>. Meer over je gegevens lees je in onze <Link href="/privacy">privacyverklaring</Link>.</p>
    </Legal>
  );
}
