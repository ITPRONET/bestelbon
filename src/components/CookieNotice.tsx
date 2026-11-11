"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_PATHS } from "@/lib/reserved";

// Alleen noodzakelijke cookies: geen toestemming nodig, wel duidelijke info (ePrivacy / GBA).
// Op een bestelpagina bovenaan, zodat de knop "Bestelling plaatsen" vrij blijft.
const KEY = "bb_cookie_ok";
export default function CookieNotice() {
  const path = usePathname() ?? "/";
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(localStorage.getItem(KEY) !== "1"); } catch { /* geen opslag: niet tonen */ } }, []);
  const first = path.split("/")[1] ?? "";
  if (!show || first === "beheer" || first === "cookies") return null;
  const shop = first !== "" && !APP_PATHS.includes(first);
  return (
    <div className={`ck ${shop ? "top" : "bottom"}`} role="region" aria-label="Cookies">
      <p>BestelBon gebruikt alleen cookies die nodig zijn om de site te laten werken. Geen tracking, geen advertenties. <Link href="/cookies">Meer info</Link></p>
      <button type="button" onClick={() => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } setShow(false); }}>OK</button>
    </div>
  );
}
