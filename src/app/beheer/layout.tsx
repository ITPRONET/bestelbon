import Link from "next/link";
import { userDb } from "@/lib/supabase-server";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const db = await userDb();
  const { data } = await db.auth.getUser();
  const home = process.env.NEXT_PUBLIC_MARKETING_URL || "https://bestelbon.eu";
  return (
    <>
      <header className="top"><div className="wrap">
        <Link className="logo" href={data.user ? "/beheer" : home}>Bestel<b>Bon</b></Link>
        {data.user
          ? <div style={{ display: "flex", gap: 8 }}><Link className="btn btn-ghost-dark" href="/beheer/wachtwoord">Wachtwoord</Link><form action="/auth/uitloggen" method="post"><button className="btn btn-ghost-dark">Uitloggen</button></form></div>
          : <a className="btn btn-ghost-dark" href={home}>Naar bestelbon.eu</a>}
      </div></header>
      <main className="wrap" style={{ paddingBlock: 20, display: "grid", gap: 16 }}>{children}</main>
    </>
  );
}
