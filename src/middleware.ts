import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Keeps the owner's login session fresh on /beheer pages.
export async function middleware(req: NextRequest) {
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
  if (!data.user && !req.nextUrl.pathname.startsWith("/beheer/login")) {
    return NextResponse.redirect(new URL("/beheer/login", req.url));
  }
  return res;
}

export const config = { matcher: ["/beheer/:path*"] };
