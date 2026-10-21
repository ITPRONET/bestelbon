"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function send(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback`, shouldCreateUser: true } });
    if (error) setError("Inloggen lukt nu niet. Probeer het over een minuut opnieuw."); else setSent(true);
  }
  return (
    <main className="wrap" style={{ maxWidth: 420, paddingBlock: 60, display: "grid", gap: 14 }}>
      <h1 style={{ margin: 0 }}>Bestel<span style={{ color: "var(--ketchup)" }}>Bon</span> beheer</h1>
      {sent ? <p>Check je mailbox: we stuurden een link om in te loggen naar <b>{email}</b>.</p> : (
        <form onSubmit={send} style={{ display: "grid", gap: 12 }}>
          <label className="field">E-mailadres<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          {error && <p className="err" role="alert" style={{ margin: 0 }}>{error}</p>}
          <button className="btn btn-primary">Stuur me een inloglink</button>
        </form>
      )}
    </main>
  );
}
