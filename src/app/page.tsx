import Link from "next/link";
import HashRedirect from "./HashRedirect";

export default function Home() {
  return (
    <main className="wrap" style={{ paddingBlock: 60, display: "grid", gap: 16, maxWidth: 640 }}>
      <HashRedirect />
      <h1 style={{ margin: 0 }}>Bestel<span style={{ color: "var(--ketchup)" }}>Bon</span></h1>
      <p className="muted">Bestelplatform voor frituren, pizzeria&apos;s en afhaalzaken.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link className="btn btn-primary" href="/frituurdekroon">Demo-bestelpagina</Link>
        <Link className="btn" href="/beheer">Beheer voor zaken</Link>
      </div>
    </main>
  );
}
