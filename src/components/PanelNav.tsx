import Link from "next/link";
import type { PanelRestaurant } from "@/lib/panel";

const TABS = [
  ["", "Bestellingen"],
  ["verkoop", "Verkoop"],
  ["printers", "Printers"],
] as const;

export default function PanelNav({ active, restaurants, current }: { active: string; restaurants: PanelRestaurant[]; current: PanelRestaurant | null }) {
  const q = current ? `?zaak=${current.slug}` : "";
  return (
    <div className="pnav">
      {restaurants.length > 1 && (
        <form method="get" className="pnav-zaak">
          <label className="sr" htmlFor="zaak">Zaak</label>
          <select id="zaak" name="zaak" defaultValue={current?.slug}>{restaurants.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}</select>
          <button className="btn">Kies</button>
        </form>
      )}
      <nav className="tabs" aria-label="Beheer">
        {TABS.map(([path, label]) => (
          <Link key={path} href={`/beheer${path ? "/" + path : ""}${q}`} aria-current={active === path ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
    </div>
  );
}
