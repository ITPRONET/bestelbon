"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

type Factor = { id: string; status: string; friendly_name?: string; created_at: string };

export default function TwoFactor({ next, required }: { next: string; required: boolean }) {
  const sb = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), []);
  const [state, setState] = useState<"laden" | "verifieer" | "beheer" | "instellen">("laden");
  const [factor, setFactor] = useState<Factor | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const [{ data: aal }, { data: f }] = await Promise.all([sb.auth.mfa.getAuthenticatorAssuranceLevel(), sb.auth.mfa.listFactors()]);
    const verified = (f?.totp ?? []).find((x) => x.status === "verified") as Factor | undefined;
    setFactor(verified ?? null);
    setState(verified ? (aal?.currentLevel === "aal2" ? "beheer" : "verifieer") : "instellen");
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setBusy(true); setMsg("");
    // Half-finished set-ups from earlier attempts are removed first.
    const { data: f } = await sb.auth.mfa.listFactors();
    for (const x of (f?.all ?? []).filter((x) => x.status !== "verified")) await sb.auth.mfa.unenroll({ factorId: x.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `BestelBon ${new Date().toLocaleDateString("nl-BE")}` });
    setBusy(false);
    if (error || !data) return setMsg("Instellen lukt nu niet. Probeer opnieuw.");
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verify(factorId: string) {
    setBusy(true); setMsg("");
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (error) { setMsg("Deze code klopt niet of is verlopen. Probeer de nieuwe code uit je app."); setCode(""); return; }
    location.replace(next);
  }

  async function disable() {
    if (!factor) return;
    setBusy(true);
    const { error } = await sb.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (error) return setMsg("Uitschakelen lukt alleen kort na het inloggen met je code. Log opnieuw in en probeer nog eens.");
    await sb.auth.refreshSession();
    location.replace("/beheer/2fa");
  }

  const codeInput = (
    <label className="field">Code van 6 cijfers
      <input value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123 456" style={{ fontSize: 22, letterSpacing: 4, textAlign: "center" }} />
    </label>
  );

  return (
    <div className="panel" style={{ maxWidth: 480, margin: "20px auto", display: "grid", gap: 14, width: "100%" }}>
      <h1 className="ph">Tweestapsverificatie</h1>
      {state === "laden" && <p className="muted">Laden…</p>}

      {state === "verifieer" && factor && (
        <form onSubmit={(e) => { e.preventDefault(); verify(factor.id); }} style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0 }}>Open je authenticator-app en vul de code voor <b>BestelBon</b> in.</p>
          {codeInput}
          {msg && <p className="err" role="alert" style={{ margin: 0 }}>{msg}</p>}
          <button className="btn btn-primary" disabled={busy || code.replace(/\s/g, "").length !== 6}>{busy ? "Controleren…" : "Bevestigen"}</button>
          <p className="muted small" style={{ margin: 0 }}>Telefoon kwijt? Mail naar info@bestelbon.eu.</p>
        </form>
      )}

      {state === "instellen" && !enroll && (
        <div style={{ display: "grid", gap: 12 }}>
          {required && <div className="alert">Voor het beheerdersaccount is tweestapsverificatie verplicht.</div>}
          <p style={{ margin: 0 }}>Naast je wachtwoord vraagt BestelBon dan een code van 6 cijfers uit een app op je telefoon. Wie je wachtwoord kent, kan zo nog altijd niet inloggen.</p>
          <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
            <li>Installeer Google Authenticator, Microsoft Authenticator of een andere authenticator-app.</li>
            <li>Klik op Instellen en scan de QR-code met die app.</li>
            <li>Vul de code in die de app toont.</li>
          </ol>
          {msg && <p className="err" style={{ margin: 0 }}>{msg}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={start} disabled={busy}>{busy ? "Bezig…" : "Instellen"}</button>
            {!required && <Link className="btn" href="/beheer">Later</Link>}
          </div>
        </div>
      )}

      {state === "instellen" && enroll && (
        <form onSubmit={(e) => { e.preventDefault(); verify(enroll.id); }} style={{ display: "grid", gap: 12, justifyItems: "center", textAlign: "center" }}>
          <p style={{ margin: 0 }}>Scan deze QR-code met je authenticator-app.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="QR-code voor je authenticator-app" width={200} height={200} style={{ background: "#fff", padding: 8, borderRadius: 12, border: "1px solid var(--line)" }} />
          <details className="small"><summary>Kan je niet scannen? Typ deze sleutel over</summary><code style={{ wordBreak: "break-all" }}>{enroll.secret}</code></details>
          <div style={{ width: "100%" }}>{codeInput}</div>
          {msg && <p className="err" role="alert" style={{ margin: 0 }}>{msg}</p>}
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy || code.replace(/\s/g, "").length !== 6}>{busy ? "Controleren…" : "Activeren"}</button>
        </form>
      )}

      {state === "beheer" && factor && (
        <div style={{ display: "grid", gap: 12 }}>
          <div className="okmsg">Tweestapsverificatie staat aan sinds {new Date(factor.created_at).toLocaleDateString("nl-BE")}.</div>
          <p className="muted small" style={{ margin: 0 }}>Nieuwe telefoon? Schakel het hier uit en stel het opnieuw in met je nieuwe telefoon. Telefoon kwijt? Mail naar info@bestelbon.eu.</p>
          {msg && <p className="err" style={{ margin: 0 }}>{msg}</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href={next}>Naar het beheer</Link>
            <details className="confirm"><summary className="btn btn-ghost">Uitschakelen</summary>
              <div className="confirm-box"><span className="small">Zonder tweede stap is je account minder goed beveiligd.</span><button className="btn btn-danger" onClick={disable} disabled={busy}>Ja, uitschakelen</button></div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
