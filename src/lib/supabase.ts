import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Read-only public client (menu, restaurant info). RLS applies. */
export function publicDb() {
  return createClient(url, anon, { auth: { persistSession: false } });
}

/** Server-only client with full rights. Never import this in client components. */
const makeAdmin = (key: string) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let admin: ReturnType<typeof makeAdmin> | null = null;
export function adminDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ontbreekt");
  // Eén client per serverinstantie (geen sessie, service role): scheelt CPU bij elke aanvraag.
  return (admin ??= makeAdmin(key));
}
