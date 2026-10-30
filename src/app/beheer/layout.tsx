import Link from "next/link";
import IdleLogout from "@/components/IdleLogout";
import { userDb } from "@/lib/supabase-server";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const db = await userDb();
  const { data } = await db.auth.getUser();
  const admin = data.user ? !!(await db.from("platform_admins").select("user_id").eq("user_id", data.user.id).maybeSingle()).data : false;
  const home = process.env.NEXT_PUBLIC_MARKETING_URL || "https://bestelbon.eu";
  return (
    <>
      <header className="top"><div className="wrap">
        <Link className="logo" href={data.user ? "/beheer" : home}>Bestel<b>Bon</b></Link>
        {data.user
          ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>{admin && <Link className="btn btn-ghost-dark" href="/beheer/admin">Beheerder</Link>}<Link className="btn btn-ghost-dark" href="/beheer/wachtwoord">Wachtwoord</Link><Link className="btn btn-ghost-dark" href="/beheer/2fa">Beveiliging</Link><form action="/auth/uitloggen" method="post"><button className="btn btn-ghost-dark">Uitloggen</button></form></div>
          : <a className="btn btn-ghost-dark" href={home}>Naar bestelbon.eu</a>}
      </div></header>
      <main className="wrap" style={{ paddingBlock: 20, display: "grid", gap: 16 }}>{children}</main>
      {data.user && <IdleLogout />}
    </>
  );
}
