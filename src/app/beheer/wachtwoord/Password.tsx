"use client";
import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function Password() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return setMsg({ ok: false, text: "Kies minstens 10 tekens." });
    if (pw !== pw2) return setMsg({ ok: false, text: "De twee wachtwoorden zijn niet gelijk." });
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await sb.auth.updateUser({ password: pw });
    setMsg(error ? { ok: false, text: "Opslaan lukte niet. Log opnieuw in en probeer nog eens." } : { ok: true, text: "Wachtwoord opgeslagen. Je kan voortaan inloggen met je e-mailadres en dit wachtwoord." });
    if (!error) { setPw(""); setPw2(""); }
  }
  return (
    <form onSubmit={save} className="panel" style={{ display: "grid", gap: 12, maxWidth: 440 }}>
      <h1 className="ph">Wachtwoord instellen</h1>
      <label className="field">Nieuw wachtwoord<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
      <label className="field">Herhaal wachtwoord<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></label>
      {msg && <p className={msg.ok ? "" : "err"} role="status" style={{ margin: 0 }}>{msg.text}</p>}
      <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary">Opslaan</button><Link className="btn" href="/beheer">Terug</Link></div>
    </form>
  );
}
