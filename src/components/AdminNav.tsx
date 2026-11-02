import Link from "next/link";

const TABS = [["", "Overzicht"], ["aanvragen", "Aanvragen"], ["nieuw", "Nieuwe klant"], ["facturen", "Facturen"], ["installaties", "Installaties"], ["gegevens", "Mijn gegevens"]] as const;

export default function AdminNav({ active, q }: { active: string; q?: string }) {
  return (
    <div className="pnav">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="pill" style={{ background: "var(--ink)", color: "#fff" }}>Beheerder</span>
        <form action="/beheer/admin" method="get" role="search" className="admin-search">
          <input name="q" type="search" defaultValue={q} placeholder="Zoek klant: naam, zaak, btw, gemeente, e-mail, telefoon" aria-label="Klant zoeken" />
          <button className="btn">Zoeken</button>
        </form>
      </div>
      <nav className="tabs" aria-label="Beheerder">
        {TABS.map(([p, l]) => <Link key={p} href={`/beheer/admin${p ? "/" + p : ""}`} aria-current={active === p ? "page" : undefined}>{l}</Link>)}
      </nav>
    </div>
  );
}
