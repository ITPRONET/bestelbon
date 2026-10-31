// Mollie calls this with only a payment id; we always fetch the real status from Mollie ourselves.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase";
import { getPayment } from "@/lib/mollie";
import { queueTickets } from "@/lib/print-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const id = String(form?.get("id") ?? "");
  if (!/^tr_[A-Za-z0-9]{4,40}$/.test(id)) return new NextResponse("OK");
  const db = adminDb();
  const { data: o } = await db.from("orders").select("id, restaurant_id, mode, status, payment_status").eq("mollie_payment_id", id).maybeSingle();
  if (!o) return new NextResponse("OK"); // onbekend: geen info lekken

  let status: string;
  try { status = (await getPayment(o.restaurant_id, id)).status; }
  catch (e) { console.error("mollie webhook", e); return new NextResponse("Retry", { status: 500 }); } // Mollie probeert later opnieuw

  if (status === "paid") {
    // Alleen de eerste melding zet de bestelling door (idempotent).
    const { data: upd } = await db.from("orders").update({ status: "in_wachtrij", payment_status: "betaald", paid_at: new Date().toISOString() })
      .eq("id", o.id).eq("status", "wacht_op_betaling").select("id");
    if (upd?.length) await queueTickets(o.id, o.restaurant_id, o.mode);
  } else if (["failed", "canceled", "expired"].includes(status)) {
    await db.from("orders").update({ status: "geannuleerd", payment_status: "mislukt" }).eq("id", o.id).eq("status", "wacht_op_betaling");
  }
  return new NextResponse("OK");
}
