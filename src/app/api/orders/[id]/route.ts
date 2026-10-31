import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase";

export const runtime = "nodejs";

// Status for the customer's status page. The order id (uuid) is the only key, so we return no personal data.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Onbekend" }, { status: 404 });
  const { data } = await adminDb().from("orders")
    .select("day_number, status, mode, total_cents, payment_method, payment_status, printed_at, created_at, restaurants ( name, prep_minutes )")
    .eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Onbekend" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
