"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { eur } from "@/lib/money";

type S = { day_number: number; status: string; mode: string; total_cents: number; restaurants: { name: string; prep_minutes: number } | null };

export default function Status({ slug, id }: { slug: string; id: string }) {
  const [s, setS] = useState<S | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
      if (!res.ok) { setMissing(true); return; }
      const data: S = await res.json();
      if (!stop) setS(data);
      if (!stop && data.status !== "geprint") setTimeout(load, 5000);
    };
    load();
    return () => { stop = true; };
  }, [id]);

  if (missing) return <main className="wrap status-card"><h1>Bestelling niet gevonden</h1><Link className="btn" href={`/${slug}`}>Terug naar het menu</Link></main>;
  if (!s) return <main className="wrap status-card"><p className="muted">Laden…</p></main>;
  const ok = s.status === "geprint";
  return (
    <main className="wrap status-card">
      <p className="muted" style={{ margin: 0 }}>{s.restaurants?.name}</p>
      <div className="big">#{s.day_number}</div>
      <p style={{ margin: 0, fontWeight: 600 }}><span className={`dot ${ok ? "ok" : ""}`} />{ok ? "Ontvangen door de zaak" : "Doorgestuurd, wacht op bevestiging van de zaak"}</p>
      <p className="muted" style={{ margin: 0 }}>
        {ok ? `Je bestelling wordt klaargemaakt. Reken op ongeveer ${s.restaurants?.prep_minutes ?? 25} minuten.` : "Deze pagina ververst vanzelf."}
      </p>
      <p className="num" style={{ margin: 0 }}>{s.mode === "levering" ? "Levering" : "Afhalen"} · {eur(s.total_cents)} · betalen bij {s.mode === "levering" ? "levering" : "afhaling"}</p>
      <Link className="btn" href={`/${slug}`}>Terug naar het menu</Link>
    </main>
  );
}
