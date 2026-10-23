import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { APP_PATHS } from "@/lib/reserved";

// On bestelbon.eu the app and the WordPress site share one domain:
// app paths and restaurant pages are served here, everything else comes from WordPress (WP_ORIGIN).
const MAIN_HOSTS = (process.env.MAIN_HOSTS ?? "bestelbon.eu").split(",").map((h) => h.trim());
const OLD_HOSTS = (process.env.OLD_HOSTS ?? "bestelbon-bestelbon1.vercel.app").split(",").map((h) => h.trim());
const CANONICAL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bestelbon.eu";
const WP_ORIGIN = process.env.WP_ORIGIN ?? "https://www.bestelbon.eu";

let slugCache: { at: number; slugs: Set<string> } | null = null;
async function slugs() {
  if (slugCache && Date.now() - slugCache.at < 60_000) return slugCache.slugs;
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/restaurants?select=slug`;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const rows = (await res.json()) as { slug: string }[];
    slugCache = { at: Date.now(), slugs: new Set(rows.map((r) => r.slug)) };
  } catch {
    slugCache ??= { at: 0, slugs: new Set() };
  }
  return slugCache.slugs;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const first = path.split("/")[1] ?? "";

  // Old app address: send people to bestelbon.eu. Printers keep using /api on the old address.
  const host = req.headers.get("host") ?? "";
  if (OLD_HOSTS.includes(host) && first !== "api") {
    return NextResponse.redirect(new URL(path + req.nextUrl.search, CANONICAL), 308);
  }

  if (MAIN_HOSTS.includes(host)) {
    const isApp = APP_PATHS.includes(first) || (first !== "" && (await slugs()).has(first));
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
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
