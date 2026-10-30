import Link from "next/link";
import { publicDb } from "@/lib/supabase";
import { eur } from "@/lib/money";
import Signup from "./Signup";
import { adminFeeWaived, ADMIN_FREE_LABEL } from "@/lib/pricing";

export const revalidate = 300;
export const metadata = { title: "Aanmelden", description: "Meld je zaak aan voor BestelBon: online bestellen met automatische keukenbonnen." };

export default async function Page({ searchParams }: { searchParams: Promise<{ pakket?: string }> }) {
  const sp = await searchParams;
  const { data } = await publicDb().from("prices").select("key, label, cents");
  const p = Object.fromEntries((data ?? []).map((x) => [x.key, x.cents])) as Record<string, number>;
  return (
    <>
      <header className="top"><div className="wrap"><Link className="logo" href={process.env.NEXT_PUBLIC_MARKETING_URL || "https://bestelbon.eu"}>Bestel<b>Bon</b></Link></div></header>
      <main className="wrap" style={{ paddingBlock: "24px 60px", display: "grid", gap: 16, maxWidth: 980 }}>
        <div>
          <h1 className="ph">Meld je zaak aan</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Vul je gegevens in. We bellen je binnen één werkdag om de installatie te plannen. Je betaalt pas na de installatie.</p>
        </div>
        <Signup
          initialPlan={sp.pakket === "pro" ? "pro" : "standaard"}
          prices={{ standaard: eur(p.standaard ?? 0), pro: eur(p.pro ?? 0), kabel: eur(p.printer_kabel ?? 0), wifi: eur(p.printer_wifi ?? 0), installatie: eur(p.installatie ?? 0), jaarStandaard: eur(Math.round((p.standaard ?? 0) * 12 * 0.9)), jaarPro: eur(Math.round((p.pro ?? 0) * 12 * 0.9)), admin: eur(p.administratie ?? 9900), adminFree: adminFeeWaived() ? ADMIN_FREE_LABEL : null }}
        />
      </main>
    </>
  );
}
