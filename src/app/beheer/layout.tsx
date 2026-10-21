import Link from "next/link";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="top"><div className="wrap">
        <Link className="logo" href="/beheer">Bestel<b>Bon</b></Link>
        <form action="/auth/uitloggen" method="post"><button className="btn btn-ghost-dark">Uitloggen</button></form>
      </div></header>
      <main className="wrap" style={{ paddingBlock: 20, display: "grid", gap: 16 }}>{children}</main>
    </>
  );
}
