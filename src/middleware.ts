import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { APP_PATHS } from "@/lib/reserved";

// On bestelbon.eu the app and the WordPress site share one domain:
// app paths and restaurant pages are served here, everything else comes from WordPress (WP_ORIGIN).
const MAIN_HOSTS = (process.env.MAIN_HOSTS ?? "bestelbon.eu").split(",").map((h) => h.trim());
const OLD_HOSTS = (process.env.OLD_HOSTS ?? "bestelbon-bestelbon1.vercel.app").split(",").map((h) => h.trim());
const CANONICAL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bestelbon.eu";
const WP_ORIGIN = process.env.WP_ORIGIN ?? "https://www.bestelbon.eu";
// Subdomains per zaak (frituurdekroon.bestelbon.eu), on when SUBDOMAIN_ROOT is set.
const SUB_ROOT = (process.env.SUBDOMAIN_ROOT ?? "").trim().toLowerCase();
const NOT_A_ZAAK = new Set(["www", "app", "api", "mail", "admin", "beheer"]);
const SHARED = ["_next", "api", "privacy", "voorwaarden", "verwerkersovereenkomst", "cookies", "favicon.ico"];

let slugCache: { at: number; slugs: Set<string>; sub: Set<string> } | null = null;
async function slugs() {
  if (slugCache && Date.now() - slugCache.at < 60_000) return slugCache.slugs;
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/restaurants?select=slug,sub_ok`;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const rows = (await res.json()) as { slug: string; sub_ok: boolean }[];
    slugCache = { at: Date.now(), slugs: new Set(rows.map((r) => r.slug)), sub: new Set(rows.filter((r) => r.sub_ok).map((r) => r.slug)) };
  } catch {
    slugCache ??= { at: 0, slugs: new Set(), sub: new Set() };
  }
  return slugCache.slugs;
}

const domainCache = new Map<string, { at: number; slug: string | null }>();
async function slugForDomain(host: string) {
  const hit = domainCache.get(host);
  if (hit && Date.now() - hit.at < 60_000) return hit.slug;
  let slug: string | null = null;
  try {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/restaurants?select=slug&domain_verified=eq.true&custom_domain=eq.${encodeURIComponent(host)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    slug = ((await res.json()) as { slug: string }[])[0]?.slug ?? null;
  } catch { /* keep null */ }
  domainCache.set(host, { at: Date.now(), slug });
  return slug;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const first = path.split("/")[1] ?? "";

  // Old app address: send people to bestelbon.eu. Printers keep using /api on the old address.
  const host = req.headers.get("host") ?? "";
  if (OLD_HOSTS.includes(host) && first !== "api") {
    return NextResponse.redirect(new URL(path + req.nextUrl.search, CANONICAL), 308);
  }

  // frituurdekroon.bestelbon.eu: the ordering page of that zaak.
  if (SUB_ROOT && host.endsWith(`.${SUB_ROOT}`)) {
    const sub = host.slice(0, -SUB_ROOT.length - 1);
    if (!sub.includes(".") && !NOT_A_ZAAK.has(sub) && (await slugs()).has(sub)) {
      if (first !== sub && !SHARED.includes(first)) {
        return NextResponse.rewrite(new URL(`/${sub}${path === "/" ? "" : path}${req.nextUrl.search}`, req.url));
      }
      return NextResponse.next();
    }
    if (!NOT_A_ZAAK.has(sub)) return NextResponse.redirect(new URL("/", CANONICAL), 307);
  }

  // Pro: the restaurant's own domain (e.g. bestellen.frituurdekroon.be) shows its ordering page.
  if (!MAIN_HOSTS.includes(host) && !host.endsWith(".vercel.app") && !host.startsWith("localhost")) {
    const slug = await slugForDomain(host);
    if (slug && first !== slug && !SHARED.includes(first)) {
      return NextResponse.rewrite(new URL(`/${slug}${path === "/" ? "" : path}${req.nextUrl.search}`, req.url));
    }
    return NextResponse.next();
  }

  if (MAIN_HOSTS.includes(host)) {
    const isSlug = first !== "" && !APP_PATHS.includes(first) && (await slugs()).has(first);
    // Old address bestelbon.eu/frituurdekroon/... -> frituurdekroon.bestelbon.eu/... (QR codes and stickers keep working).
    if (isSlug && SUB_ROOT && slugCache?.sub.has(first) && (req.method === "GET" || req.method === "HEAD")) {
      const rest = path.slice(first.length + 1);
      return NextResponse.redirect(new URL(`https://${first}.${SUB_ROOT}${rest || "/"}${req.nextUrl.search}`), 308);
    }
    const isApp = APP_PATHS.includes(first) || isSlug;
    if (!isApp) {
      // WordPress recognises proxied requests by this key (see wp-config.php) and then acts as bestelbon.eu.
      const headers = new Headers(req.headers);
      headers.set("x-bb-proxy", process.env.WP_PROXY_KEY ?? "");
      headers.set("x-forwarded-host", req.headers.get("host") ?? "");
      return NextResponse.rewrite(new URL(path + req.nextUrl.search, WP_ORIGIN), { request: { headers } });
    }
  }

  if (first !== "beheer") return NextResponse.next();

  // Keeps the owner's login session fresh on /beheer pages.
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && !path.startsWith("/beheer/login")) {
    return NextResponse.redirect(new URL("/beheer/login", req.url));
  }
  // Automatisch uitloggen na 30 minuten zonder activiteit (ook als de tab dicht was).
  const last = Number(req.cookies.get("bb_act")?.value ?? 0);
  if (data.user && last && Date.now() - last > 30 * 60_000 && !path.startsWith("/beheer/login")) {
    await supabase.auth.signOut();
    const out = NextResponse.redirect(new URL("/beheer/login?reden=inactief", req.url));
    res.cookies.getAll().forEach((c) => out.cookies.set(c));
    out.cookies.delete("bb_act");
    return out;
  }
  if (data.user) res.cookies.set("bb_act", String(Date.now()), { path: "/", maxAge: 86400, sameSite: "lax", secure: true });
  // Tweestapsverificatie aan? Dan eerst de code, voor elke beheerpagina.
  if (data.user && !path.startsWith("/beheer/2fa") && !path.startsWith("/beheer/login")) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const to = new URL("/beheer/2fa", req.url);
      to.searchParams.set("next", path + req.nextUrl.search);
      return NextResponse.redirect(to);
    }
  }
  return res;
}

// Niet voor de printer-polls (api/cloudprnt) en statische bestanden: scheelt een middleware-aanroep per poll.
export const config = { matcher: ["/((?!_next/static|_next/image|api/cloudprnt|favicon.ico).*)"] };
