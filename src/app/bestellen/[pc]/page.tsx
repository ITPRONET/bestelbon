import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { gidsFor, gidsPublic, guard, pcInfo, PICKUP_KM } from "@/lib/gids";
import { GidsFoot, GidsHead, GidsList } from "../Gids";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ pc: string }> }): Promise<Metadata> {
  const { pc } = await params;
  const p = pcInfo(pc);
  const pub = await gidsPublic();
  return {
    title: p ? `Eten bestellen in ${p.name} (${pc})` : "Eten bestellen",
    description: p ? `Frituren, pizzeria's en afhaalzaken die leveren in ${p.name}. Rechtstreeks bij de zaak bestellen, zonder tussenpersoon.` : undefined,
    robots: pub ? undefined : { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ pc: string }> }) {
  const { pc } = await params;
  if (!/^\d{4}$/.test(pc)) notFound();
  const pub = await guard();
  const res = await gidsFor(pc);
  const storage = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zaak-media/`;
  return (
    <div className="g-root">
      {!pub && <div className="g-preview">Voorbeeld: de gids is nog niet publiek. Alleen jij als beheerder ziet deze pagina.</div>}
      <GidsHead pc={pc} place={res?.here.name} />
      <main className="wrap g-main">
        {!res ? <p className="g-empty">Deze postcode kennen we niet. Controleer de 4 cijfers.</p> : (
          <>
            <GidsList title="Levert bij jou" items={res.levering} storage={storage} mode="levering" empty={`Nog geen zaak die levert in ${res.here.name}. Kijk bij afhalen.`} />
            <GidsList title={`Afhalen in de buurt (tot ${PICKUP_KM} km)`} items={res.afhalen} storage={storage} mode="afhalen" empty="Nog geen zaak in de buurt." />
          </>
        )}
      </main>
      <GidsFoot />
    </div>
  );
}
