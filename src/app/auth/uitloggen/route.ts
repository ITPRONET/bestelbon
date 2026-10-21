import { NextResponse } from "next/server";
import { userDb } from "@/lib/supabase-server";

// After logging out, go back to the public website (bestelbon.eu).
export async function POST() {
  const db = await userDb();
  await db.auth.signOut();
  const home = process.env.NEXT_PUBLIC_MARKETING_URL || "https://bestelbon.eu";
  return NextResponse.redirect(home, { status: 303 });
}
