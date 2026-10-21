import Link from "next/link";

const TABS = [["", "Overzicht"], ["nieuw", "Nieuwe klant"], ["facturen", "Facturen"], ["installaties", "Installaties"], ["gegevens", "Mijn gegevens"]] as const;

export default function AdminNav({ active }: { active: string }) {
  return (
    <div className="pnav">
      <span className="pill" style={{ background: "var(--ink)", color: "#fff" }}>Beheerder</span>
      <nav className="tabs" aria-label="Beheerder">
        {TABS.map(([p, l]) => <Link key={p} href={`/beheer/admin${p ? "/" + p : ""}`} aria-current={active === p ? "page" : undefined}>{l}</Link>)}
      </nav>
    </div>
  );
}
