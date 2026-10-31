"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { eur } from "@/lib/money";

type S = { day_number: number; status: string; mode: string; total_cents: number; payment_method: string; payment_status: string; restaurants: { name: string; prep_minutes: number } | null };

export default function Status({ slug, id }: { slug: string; id: string }) {
  const [s, setS] = useState<S | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
      if (!res.ok) { setMissing(true); return; }
      const data: S = await res.json();
      if (stop) return;
      setS(data);
      // Paid (or cash): the saved cart is no longer needed. Failed payment: keep it so the menu restores it.
      if (data.status !== "wacht_op_betaling" && data.status !== "geannuleerd") { try { sessionStorage.removeItem(`bb_cart_${slug}`); } catch { /* ignore */ } }
      if (data.status !== "geprint" && data.status !== "geannuleerd") setTimeout(load, data.status === "wacht_op_betaling" ? 2500 : 5000);
    };
    load();
    return () => { stop = true; };
  }, [id, slug]);

  if (missing) return <main className="wrap status-card"><h1>Bestelling niet gevonden</h1><Link className="btn" href={`/${slug}`}>Terug naar het menu</Link></main>;
  if (!s) return <main className="wrap status-card"><p className="muted">Laden…</p></main>;

  if (s.status === "geannuleerd") return (
    <main className="wrap status-card">
      <p className="muted" style={{ margin: 0 }}>{s.restaurants?.name}</p>
      <h1 style={{ margin: "4px 0" }}>Betaling niet gelukt</h1>
      <p className="muted" style={{ margin: 0 }}>Je bestelling is niet doorgestuurd en er is niets afgeschreven. Je mandje staat nog klaar.</p>
      <Link className="btn btn-primary" href={`/${slug}`}>Opnieuw proberen</Link>
    </main>
  );
  if (s.status === "wacht_op_betaling") return (
    <main className="wrap status-card">
      <p className="muted" style={{ margin: 0 }}>{s.restaurants?.name}</p>
      <div className="big">#{s.day_number}</div>
      <p style={{ margin: 0, fontWeight: 600 }}><span className="dot" />We wachten op de bevestiging van je betaling…</p>
      <p className="muted" style={{ margin: 0 }}>Dit duurt meestal enkele seconden. Deze pagina ververst vanzelf.</p>
    </main>
  );

  const ok = s.status === "geprint";
  const paid = s.payment_method === "online" && s.payment_status === "betaald";
  return (
    <main className="wrap status-card">
      <p className="muted" style={{ margin: 0 }}>{s.restaurants?.name}</p>
      <div className="big">#{s.day_number}</div>
      <p style={{ margin: 0, fontWeight: 600 }}><span className={`dot ${ok ? "ok" : ""}`} />{ok ? "Ontvangen door de zaak" : "Doorgestuurd, wacht op bevestiging van de zaak"}</p>
      <p className="muted" style={{ margin: 0 }}>
        {ok ? `Je bestelling wordt klaargemaakt. Reken op ongeveer ${s.restaurants?.prep_minutes ?? 25} minuten.` : "Deze pagina ververst vanzelf."}
      </p>
      <p className="num" style={{ margin: 0 }}>{s.mode === "levering" ? "Levering" : "Afhalen"} · {eur(s.total_cents)} · {paid ? "betaald online" : `betalen bij ${s.mode === "levering" ? "levering" : "afhaling"}`}</p>
      <Link className="btn" href={`/${slug}`}>Terug naar het menu</Link>
    </main>
  );
}
