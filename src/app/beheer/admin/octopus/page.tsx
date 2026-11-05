import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { adminOnly } from "@/lib/admin";
import { octopusEnabled, octopusLive, octopusSetup } from "@/lib/octopus";

export const dynamic = "force-dynamic";
export const metadata = { title: "Octopus" };

export default async function Page() {
  await adminOnly();
  let info: Awaited<ReturnType<typeof octopusSetup>> | null = null;
  let err = "";
  if (octopusEnabled()) { try { info = await octopusSetup(); } catch (e) { err = (e as Error).message; } }
  return (
    <main className="wrap" style={{ display: "grid", gap: 16, paddingBlock: 20 }}>
      <AdminNav active="facturen" />
      <h1 className="ph">Octopus-koppeling</h1>
      <section className="panel" style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0 }}>Betaalde facturen gaan automatisch naar Octopus: klant aanmaken of bijwerken, factuur boeken in het verkoopdagboek en versturen via Peppol (Belgisch btw-nummer) of anders per e-mail.</p>
        {!octopusEnabled() ? (
          <div className="alert" style={{ margin: 0 }}>Nog niet ingesteld. Zet in Vercel: <code>OCTOPUS_SOFTWARE_HOUSE_UUID</code>, <code>OCTOPUS_USER</code>, <code>OCTOPUS_PASSWORD</code> (sensitive) en <code>OCTOPUS_DOSSIER_ID</code>.</div>
        ) : err ? (
          <div className="alert" style={{ margin: 0 }}>Verbinding mislukt: {err}</div>
        ) : info && (
          <>
            <p style={{ margin: 0 }}><span className={`pill ${octopusLive() ? "ok" : "wait"}`}>{octopusLive() ? "productie: facturen worden verstuurd" : "testmodus: facturen worden aangemaakt, niet verstuurd"}</span></p>
            <p className="small" style={{ margin: 0 }}>Dossier: <b>{info.dossierName}</b> · boekjaar {info.bookyear ? `${info.bookyear.start} – ${info.bookyear.end}` : "geen open boekjaar"}</p>
            <p className="small" style={{ margin: 0 }}>Gebruikt: dagboek <b>{info.config.journal}</b>, btw-code <b>{info.config.vatCode}</b>, rekening <b>{info.config.accountId ?? "standaard van de btw-code"}</b>. Voorstel uit Octopus: dagboek {info.suggestion.journal}, btw-code {info.suggestion.vatCode}{info.suggestion.accountId ? `, rekening ${info.suggestion.accountId}` : ""}.</p>
            <details><summary className="small">Dagboeken en btw-codes</summary>
              <p className="small">{info.journals.map((j) => `${j.key} ${j.name}${j.closed ? " (gesloten)" : ""} · laatste nr ${j.last ?? "-"}`).join(" | ")}</p>
              <p className="small">{info.vatCodes.map((v) => `${v.code} (${v.pct ?? "?"}%) ${v.description}`).join(" | ")}</p>
            </details>
          </>
        )}
        <p className="muted small" style={{ margin: 0 }}>Mislukte pogingen worden automatisch herhaald (dagelijkse cron) of met &quot;opnieuw&quot; bij de factuur. <Link href="/beheer/admin/facturen">Naar facturen</Link></p>
      </section>
    </main>
  );
}
