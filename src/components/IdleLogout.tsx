"use client";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export const IDLE_MINUTES = 30;
const WARN_BEFORE = 2 * 60_000;
const LIMIT = IDLE_MINUTES * 60_000;

const readLast = () => Number(document.cookie.match(/(?:^|; )bb_act=(\d+)/)?.[1] ?? Date.now());
const writeLast = () => { document.cookie = `bb_act=${Date.now()}; path=/; max-age=86400; samesite=lax; secure`; };

/** Logs the user out after 30 minutes without activity; shared across tabs through a cookie. */
export default function IdleLogout() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    let lastWrite = 0;
    const activity = () => { if (Date.now() - lastWrite > 30_000) { lastWrite = Date.now(); writeLast(); } };
    const events = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    events.forEach((e) => addEventListener(e, activity, { passive: true }));
    writeLast();
    const tick = async () => {
      const idle = Date.now() - readLast();
      if (idle >= LIMIT) {
        const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        await sb.auth.signOut().catch(() => null);
        location.replace("/beheer/login?reden=inactief");
      } else setLeft(idle >= LIMIT - WARN_BEFORE ? Math.ceil((LIMIT - idle) / 1000) : null);
    };
    const i = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(i); events.forEach((e) => removeEventListener(e, activity)); document.removeEventListener("visibilitychange", tick); };
  }, []);
  if (left === null) return null;
  return (
    <div className="idle-warn" role="alertdialog" aria-live="assertive">
      <span>Je wordt over {left} seconden uitgelogd omdat je niets deed.</span>
      <button className="btn btn-primary" onClick={() => { writeLast(); setLeft(null); }}>Ingelogd blijven</button>
    </div>
  );
}
