import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Client for the signed-in owner (cookies). RLS applies. */
export async function userDb() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a server component: middleware refreshes the session */
        }
      },
    },
  });
}
