import type { Metadata } from "next";
import { gidsPublic, guard } from "@/lib/gids";
import { GidsFoot, GidsHead } from "./Gids";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const pub = await gidsPublic();
  return { title: "Eten bestellen bij jou in de buurt", description: "Bestel rechtstreeks bij frituren, pizzeria's en afhaalzaken in je gemeente, zonder tussenpersoon.", robots: pub ? undefined : { index: false, follow: false } };
}

export default async function Page() {
  const pub = await guard();
  return (
    <div className="g-root">
      {!pub && <div className="g-preview">Voorbeeld: de gids is nog niet publiek. Alleen jij als beheerder ziet deze pagina.</div>}
      <GidsHead />
      <GidsFoot />
    </div>
  );
}
