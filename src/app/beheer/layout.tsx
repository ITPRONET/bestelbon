import Link from "next/link";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="top"><div className="wrap">
        <Link className="logo" href="/beheer">Bestel<b>Bon</b></Link>
        <nav style={{ display: "flex", gap: 14 }}><Link href="/beheer" style={{ color: "#fff" }}>Bestellingen</Link><Link href="/beheer/printers" style={{ color: "#fff" }}>Printers</Link></nav>
      </div></header>
      <main className="wrap" style={{ paddingBlock: 24, display: "grid", gap: 16 }}>{children}</main>
    </>
  );
}
