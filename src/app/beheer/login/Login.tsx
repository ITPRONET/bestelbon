"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const sb = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function message(err: { code?: string; status?: number; message?: string }) {
  if (err.code === "over_email_send_rate_limit" || err.status === 429) return "Er zijn te veel inloglinks verstuurd. Wacht even, of log in met je wachtwoord.";
  if (err.code === "invalid_credentials") return "E-mailadres of wachtwoord klopt niet.";
  return "Inloggen lukt nu niet. Probeer het over een minuut opnieuw.";
}

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"wachtwoord" | "link">("wachtwoord");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    if (mode === "wachtwoord") {
      const { error } = await sb().auth.signInWithPassword({ email, password });
      if (error) { setError(message(error)); setBusy(false); return; }
      router.push("/beheer"); router.refresh();
    } else {
      const { error } = await sb().auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback`, shouldCreateUser: true } });
      if (error) setError(message(error)); else setSent(true);
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", display: "grid", gap: 14, width: "100%" }}>
      <h1 style={{ margin: 0 }}>Bestel<span style={{ color: "var(--ketchup)" }}>Bon</span> beheer</h1>
      {sent ? <p>Check je mailbox: we stuurden een link om in te loggen naar <b>{email}</b>.</p> : (
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <label className="field">E-mailadres<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          {mode === "wachtwoord" && <label className="field">Wachtwoord<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>}
          {error && <p className="err" role="alert" style={{ margin: 0 }}>{error}</p>}
          <button className="btn btn-primary" disabled={busy}>{busy ? "Bezig…" : mode === "wachtwoord" ? "Inloggen" : "Stuur me een inloglink"}</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setMode(mode === "wachtwoord" ? "link" : "wachtwoord"); setError(""); }}>
            {mode === "wachtwoord" ? "Geen wachtwoord? Log in met een link per e-mail" : "Inloggen met wachtwoord"}
          </button>
        </form>
      )}
    </div>
  );
}
