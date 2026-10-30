"use client";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

// Landing for invitation and password-reset e-mails: the session arrives in the URL fragment.
export default function Page() {
  const [msg, setMsg] = useState("Even geduld…");
  useEffect(() => {
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const h = new URLSearchParams(location.hash.slice(1));
    const at = h.get("access_token"), rt = h.get("refresh_token");
    const code = new URLSearchParams(location.search).get("code");
    (async () => {
      if (at && rt) {
        const { error } = await sb.auth.setSession({ access_token: at, refresh_token: rt });
        if (error) return setMsg("Deze link is verlopen. Vraag een nieuwe aan via info@bestelbon.eu.");
      } else if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) return setMsg("Deze link is verlopen. Vraag een nieuwe aan via info@bestelbon.eu.");
      } else if (h.get("error")) {
        return setMsg("Deze link is verlopen of al gebruikt. Vraag een nieuwe aan via info@bestelbon.eu.");
      }
      document.cookie = `bb_act=${Date.now()}; path=/; max-age=86400; samesite=lax; secure`;
      location.replace("/beheer/wachtwoord?welkom=1");
    })();
  }, []);
  return <main className="wrap" style={{ paddingBlock: 60 }}><p>{msg}</p></main>;
}
